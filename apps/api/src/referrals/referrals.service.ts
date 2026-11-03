import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  ReferralCampaignStatus,
  ReferralPayoutStatus,
  ReferralPointTxnType,
  ReferralRewardStatus,
  ReferralStatus,
} from '../prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CAMPAIGN_NAME = 'Refer & Earn';
const UPI_PATTERN = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

type ReferrerKind = 'FRESHER' | 'EXPERIENCED';

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureActiveCampaign() {
    const existing = await this.prisma.referralCampaign.findFirst({
      where: { campaignStatus: ReferralCampaignStatus.ACTIVE },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.referralCampaign.create({
      data: {
        campaignName: DEFAULT_CAMPAIGN_NAME,
        fresherBatchSize: 3,
        experiencedBatchSize: 1,
        pointsPerBatch: 10,
        pointsToPayoutEligible: 100,
        startDate: new Date(),
        campaignStatus: ReferralCampaignStatus.ACTIVE,
      },
    });
  }

  async ensureReferralCodeForCandidate(candidateId: string) {
    const existing = await this.prisma.candidateReferralCode.findUnique({
      where: { candidateId },
    });
    if (existing) return existing;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const referralCode = this.buildCode(candidateId, attempt);
      try {
        return await this.prisma.candidateReferralCode.create({
          data: { candidateId, referralCode, isActive: true },
        });
      } catch {
        // unique collision — retry
      }
    }
    throw new ConflictException('Could not allocate a referral code. Try again.');
  }

  async validatePublicCode(rawCode: string) {
    const code = this.normalizeCode(rawCode);
    if (!code) return { valid: false as const };
    const row = await this.prisma.candidateReferralCode.findUnique({
      where: { referralCode: code },
      include: {
        candidate: {
          select: { firstName: true, lastName: true },
        },
      },
    });
    if (!row || !row.isActive) return { valid: false as const };
    const name = [row.candidate.firstName, row.candidate.lastName].filter(Boolean).join(' ').trim();
    return {
      valid: true as const,
      referralCode: row.referralCode,
      referrerName: name || 'a CareerBridge candidate',
    };
  }

  /**
   * Called after a new candidate account is created. Attribution only —
   * eligibility/points run when the referral is approved (auto on register).
   */
  async attributeRegistration(input: {
    referredCandidateId: string;
    referralCode?: string | null;
    referralSource?: string | null;
  }) {
    const code = this.normalizeCode(input.referralCode || '');
    if (!code) return null;

    const codeRow = await this.prisma.candidateReferralCode.findUnique({
      where: { referralCode: code },
    });
    if (!codeRow || !codeRow.isActive) return null;
    if (codeRow.candidateId === input.referredCandidateId) return null;

    const already = await this.prisma.candidateReferral.findUnique({
      where: { referredCandidateId: input.referredCandidateId },
    });
    if (already) return already;

    const campaign = await this.ensureActiveCampaign();
    const now = new Date();
    const referral = await this.prisma.candidateReferral.create({
      data: {
        referrerCandidateId: codeRow.candidateId,
        referredCandidateId: input.referredCandidateId,
        referralCode: codeRow.referralCode,
        campaignId: campaign.id,
        referralSource: (input.referralSource || 'LINK').slice(0, 40),
        status: ReferralStatus.APPROVED,
        verifiedAt: now,
        approvedAt: now,
      },
    });

    await this.prisma.referralReward.create({
      data: {
        referralId: referral.id,
        referrerCandidateId: codeRow.candidateId,
        rewardAmount: campaign.rewardAmount,
        currency: campaign.currency,
        rewardStatus: ReferralRewardStatus.APPROVED,
        approvedAt: now,
      },
    });

    await this.syncPointsForReferrer(codeRow.candidateId);
    return referral;
  }

  async getCandidateDashboard(userId: string) {
    const candidate = await this.requireCandidate(userId);
    const codeRow = await this.ensureReferralCodeForCandidate(candidate.id);
    const campaign = await this.ensureActiveCampaign();
    const kind = this.referrerKind(candidate);

    const [approvedCount, referrals, ledger, payouts] = await Promise.all([
      this.prisma.candidateReferral.count({
        where: { referrerCandidateId: candidate.id, status: ReferralStatus.APPROVED },
      }),
      this.prisma.candidateReferral.findMany({
        where: { referrerCandidateId: candidate.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          referred: {
            select: {
              firstName: true,
              lastName: true,
              createdAt: true,
              user: { select: { phone: true } },
            },
          },
        },
      }),
      this.prisma.referralPointLedger.findMany({
        where: { referrerCandidateId: candidate.id },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.referralPayoutRequest.findMany({
        where: { referrerCandidateId: candidate.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const pointsBalance = this.sumPoints(ledger);
    const pendingPayout = payouts.find((p) => p.status === ReferralPayoutStatus.PENDING) || null;
    const eligible =
      pointsBalance >= campaign.pointsToPayoutEligible && !pendingPayout;

    const batchSize =
      kind === 'FRESHER' ? campaign.fresherBatchSize : campaign.experiencedBatchSize;
    const towardNextBatch = approvedCount % batchSize;
    const neededForNext = towardNextBatch === 0 && approvedCount > 0 ? 0 : batchSize - towardNextBatch;

    return {
      referralCode: codeRow.referralCode,
      sharePath: `/register?role=candidate&ref=${encodeURIComponent(codeRow.referralCode)}`,
      referrerKind: kind,
      rules: {
        fresherBatchSize: campaign.fresherBatchSize,
        experiencedBatchSize: campaign.experiencedBatchSize,
        pointsPerBatch: campaign.pointsPerBatch,
        pointsToPayoutEligible: campaign.pointsToPayoutEligible,
      },
      stats: {
        approvedReferrals: approvedCount,
        pointsBalance,
        pointsToPayoutEligible: campaign.pointsToPayoutEligible,
        referralsNeededForNextBatch: neededForNext,
        payoutEligible: eligible,
      },
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        submittedAt: r.submittedAt,
        approvedAt: r.approvedAt,
        referredName: [r.referred.firstName, r.referred.lastName].filter(Boolean).join(' ') || 'Candidate',
        referredPhoneMasked: this.maskPhone(r.referred.user?.phone),
      })),
      ledger: ledger.map((row) => ({
        id: row.id,
        type: row.transactionType,
        points: row.points,
        reference: row.reference,
        notes: row.notes,
        createdAt: row.createdAt,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        upiId: p.upiId,
        pointsAtRequest: p.pointsAtRequest,
        status: p.status,
        paymentReference: p.paymentReference,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
      })),
      pendingPayout: pendingPayout
        ? {
            id: pendingPayout.id,
            upiId: pendingPayout.upiId,
            pointsAtRequest: pendingPayout.pointsAtRequest,
            createdAt: pendingPayout.createdAt,
          }
        : null,
    };
  }

  async submitPayoutRequest(userId: string, upiIdRaw: string) {
    const upiId = upiIdRaw.trim();
    if (!UPI_PATTERN.test(upiId)) {
      throw new BadRequestException('Enter a valid UPI ID (example: name@upi).');
    }
    const candidate = await this.requireCandidate(userId);
    const campaign = await this.ensureActiveCampaign();
    const balance = await this.pointsBalance(candidate.id);
    if (balance < campaign.pointsToPayoutEligible) {
      throw new BadRequestException(
        `You need ${campaign.pointsToPayoutEligible} points before submitting UPI details.`,
      );
    }
    const pending = await this.prisma.referralPayoutRequest.findFirst({
      where: {
        referrerCandidateId: candidate.id,
        status: ReferralPayoutStatus.PENDING,
      },
    });
    if (pending) {
      throw new ConflictException('You already have a pending payout request.');
    }

    return this.prisma.referralPayoutRequest.create({
      data: {
        referrerCandidateId: candidate.id,
        upiId,
        pointsAtRequest: balance,
        status: ReferralPayoutStatus.PENDING,
      },
    });
  }

  async adminList(params: { status?: string; payoutStatus?: string; q?: string }) {
    const status = this.parseReferralStatus(params.status);
    const payoutStatus = this.parsePayoutStatus(params.payoutStatus);

    const [referrals, payouts, campaign] = await Promise.all([
      this.prisma.candidateReferral.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          referrer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              hasExperience: true,
              employmentStatus: true,
              user: { select: { phone: true, email: true } },
            },
          },
          referred: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { phone: true, email: true } },
            },
          },
          reward: true,
        },
      }),
      this.prisma.referralPayoutRequest.findMany({
        where: payoutStatus ? { status: payoutStatus } : undefined,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          referrer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { phone: true, email: true } },
            },
          },
        },
      }),
      this.ensureActiveCampaign(),
    ]);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.campaignName,
        fresherBatchSize: campaign.fresherBatchSize,
        experiencedBatchSize: campaign.experiencedBatchSize,
        pointsPerBatch: campaign.pointsPerBatch,
        pointsToPayoutEligible: campaign.pointsToPayoutEligible,
        status: campaign.campaignStatus,
      },
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        referralCode: r.referralCode,
        submittedAt: r.submittedAt,
        approvedAt: r.approvedAt,
        fraudFlag: r.fraudFlag,
        rejectionReason: r.rejectionReason,
        referrer: {
          id: r.referrer.id,
          name: [r.referrer.firstName, r.referrer.lastName].filter(Boolean).join(' ') || '—',
          phone: r.referrer.user.phone,
          kind: this.referrerKind(r.referrer),
        },
        referred: {
          id: r.referred.id,
          name: [r.referred.firstName, r.referred.lastName].filter(Boolean).join(' ') || '—',
          phone: r.referred.user.phone,
        },
        rewardStatus: r.reward?.rewardStatus || null,
      })),
      payouts: payouts.map((p) => ({
        id: p.id,
        status: p.status,
        upiId: p.upiId,
        pointsAtRequest: p.pointsAtRequest,
        paymentReference: p.paymentReference,
        adminNote: p.adminNote,
        paidAt: p.paidAt,
        createdAt: p.createdAt,
        referrer: {
          id: p.referrer.id,
          name: [p.referrer.firstName, p.referrer.lastName].filter(Boolean).join(' ') || '—',
          phone: p.referrer.user.phone,
          email: p.referrer.user.email,
        },
      })),
    };
  }

  async adminReviewReferral(
    referralId: string,
    action: 'APPROVE' | 'REJECT' | 'HOLD',
    adminUserId: string,
    reason?: string,
  ) {
    const referral = await this.prisma.candidateReferral.findUnique({
      where: { id: referralId },
    });
    if (!referral) throw new NotFoundException('Referral not found.');

    const now = new Date();
    if (action === 'APPROVE') {
      const updated = await this.prisma.candidateReferral.update({
        where: { id: referralId },
        data: {
          status: ReferralStatus.APPROVED,
          approvedAt: now,
          verifiedAt: referral.verifiedAt || now,
          reviewedBy: adminUserId,
          rejectionReason: null,
          fraudFlag: false,
        },
      });
      await this.prisma.referralReward.upsert({
        where: { referralId },
        create: {
          referralId,
          referrerCandidateId: referral.referrerCandidateId,
          rewardAmount: 0,
          rewardStatus: ReferralRewardStatus.APPROVED,
          approvedAt: now,
        },
        update: {
          rewardStatus: ReferralRewardStatus.APPROVED,
          approvedAt: now,
        },
      });
      await this.syncPointsForReferrer(referral.referrerCandidateId);
      return updated;
    }

    if (action === 'HOLD') {
      return this.prisma.candidateReferral.update({
        where: { id: referralId },
        data: {
          status: ReferralStatus.ON_HOLD,
          reviewedBy: adminUserId,
          rejectionReason: reason?.trim() || null,
        },
      });
    }

    const updated = await this.prisma.candidateReferral.update({
      where: { id: referralId },
      data: {
        status: ReferralStatus.REJECTED,
        reviewedBy: adminUserId,
        rejectionReason: reason?.trim() || 'Rejected by admin',
        fraudFlag: Boolean(reason?.toLowerCase().includes('fraud')),
      },
    });
    await this.prisma.referralReward.updateMany({
      where: { referralId },
      data: { rewardStatus: ReferralRewardStatus.CANCELLED },
    });
    await this.syncPointsForReferrer(referral.referrerCandidateId);
    return updated;
  }

  async adminReviewPayout(
    payoutId: string,
    action: 'PAID' | 'REJECT',
    adminUserId: string,
    opts?: { paymentReference?: string; adminNote?: string },
  ) {
    const payout = await this.prisma.referralPayoutRequest.findUnique({
      where: { id: payoutId },
    });
    if (!payout) throw new NotFoundException('Payout request not found.');
    if (payout.status !== ReferralPayoutStatus.PENDING) {
      throw new BadRequestException('This payout request was already reviewed.');
    }

    if (action === 'REJECT') {
      return this.prisma.referralPayoutRequest.update({
        where: { id: payoutId },
        data: {
          status: ReferralPayoutStatus.REJECTED,
          reviewedBy: adminUserId,
          adminNote: opts?.adminNote?.trim() || null,
        },
      });
    }

    const paymentReference = opts?.paymentReference?.trim();
    if (!paymentReference) {
      throw new BadRequestException('Payment reference is required when marking paid.');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.referralPayoutRequest.update({
        where: { id: payoutId },
        data: {
          status: ReferralPayoutStatus.PAID,
          paymentReference,
          reviewedBy: adminUserId,
          adminNote: opts?.adminNote?.trim() || null,
          paidAt: now,
        },
      });
      await tx.referralPointLedger.create({
        data: {
          referrerCandidateId: payout.referrerCandidateId,
          transactionType: ReferralPointTxnType.REDEEM,
          points: -Math.abs(payout.pointsAtRequest),
          reference: `payout:${payout.id}`,
          notes: `UPI payout ${paymentReference}`,
          createdBy: adminUserId,
        },
      });
      await tx.referralRewardTransaction.create({
        data: {
          referrerCandidateId: payout.referrerCandidateId,
          transactionType: 'UPI_PAYOUT',
          amount: 0,
          reference: paymentReference,
          notes: opts?.adminNote?.trim() || `Paid to ${payout.upiId}`,
          createdBy: adminUserId,
        },
      });
      return row;
    });

    return updated;
  }

  /** Recompute expected CREDIT batches from approved referral count; append missing credits. */
  async syncPointsForReferrer(referrerCandidateId: string) {
    const [candidate, campaign, approvedCount, credits] = await Promise.all([
      this.prisma.candidate.findUnique({ where: { id: referrerCandidateId } }),
      this.ensureActiveCampaign(),
      this.prisma.candidateReferral.count({
        where: { referrerCandidateId, status: ReferralStatus.APPROVED },
      }),
      this.prisma.referralPointLedger.findMany({
        where: {
          referrerCandidateId,
          transactionType: ReferralPointTxnType.CREDIT,
        },
      }),
    ]);
    if (!candidate) return;

    const kind = this.referrerKind(candidate);
    const batchSize =
      kind === 'FRESHER' ? campaign.fresherBatchSize : campaign.experiencedBatchSize;
    const expectedBatches = Math.floor(approvedCount / batchSize);
    const creditedBatches = credits.filter((c) => c.reference?.startsWith('batch:')).length;

    for (let batch = creditedBatches + 1; batch <= expectedBatches; batch += 1) {
      const reference = `batch:${kind.toLowerCase()}:${batch}`;
      try {
        await this.prisma.referralPointLedger.create({
          data: {
            referrerCandidateId,
            transactionType: ReferralPointTxnType.CREDIT,
            points: campaign.pointsPerBatch,
            reference,
            notes:
              kind === 'FRESHER'
                ? `${campaign.fresherBatchSize} successful referrals → ${campaign.pointsPerBatch} points`
                : `1 successful referral → ${campaign.pointsPerBatch} points`,
          },
        });
      } catch {
        // unique reference already exists
      }
    }
  }

  private async pointsBalance(candidateId: string) {
    const rows = await this.prisma.referralPointLedger.findMany({
      where: { referrerCandidateId: candidateId },
      select: { points: true },
    });
    return this.sumPoints(rows);
  }

  private sumPoints(rows: Array<{ points: number }>) {
    return rows.reduce((sum, row) => sum + row.points, 0);
  }

  private referrerKind(candidate: {
    hasExperience?: string | null;
    employmentStatus?: string | null;
    totalExperienceYears?: number | null;
  }): ReferrerKind {
    const hasExp = (candidate.hasExperience || '').toUpperCase();
    const status = (candidate.employmentStatus || '').toUpperCase();
    if (hasExp === 'NO' || status === 'FRESHER' || status === 'STUDENT') {
      return 'FRESHER';
    }
    if ((candidate.totalExperienceYears || 0) <= 0 && hasExp !== 'YES' && status !== 'EMPLOYED') {
      return 'FRESHER';
    }
    return 'EXPERIENCED';
  }

  private async requireCandidate(userId: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        hasExperience: true,
        employmentStatus: true,
        totalExperienceYears: true,
      },
    });
    if (!candidate) throw new NotFoundException('Candidate profile not found.');
    return candidate;
  }

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);
  }

  private buildCode(candidateId: string, salt: number) {
    const digest = createHash('sha256')
      .update(`${candidateId}:${salt}:${randomBytes(4).toString('hex')}`)
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();
    return `CB${digest}`;
  }

  private maskPhone(phone?: string | null) {
    if (!phone) return '—';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '••••';
    return `••••${digits.slice(-4)}`;
  }

  private parseReferralStatus(value?: string): ReferralStatus | undefined {
    if (!value) return undefined;
    const upper = value.toUpperCase();
    return (Object.values(ReferralStatus) as string[]).includes(upper)
      ? (upper as ReferralStatus)
      : undefined;
  }

  private parsePayoutStatus(value?: string): ReferralPayoutStatus | undefined {
    if (!value) return undefined;
    const upper = value.toUpperCase();
    return (Object.values(ReferralPayoutStatus) as string[]).includes(upper)
      ? (upper as ReferralPayoutStatus)
      : undefined;
  }
}
