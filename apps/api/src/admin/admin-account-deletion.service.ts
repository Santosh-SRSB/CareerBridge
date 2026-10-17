import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ErrorCode } from '@careerbridge/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { canonicalProfilePhotoPaths } from '../candidates/profile-photo.util';
import { canonicalCompanyLogoPaths } from '../employers/company-logo.util';

export type DeletableAccountKind = 'CANDIDATE' | 'EMPLOYER' | 'ADMIN';

/** Only accounts that staff have already taken out of use can be permanently deleted. */
export const DELETABLE_ACCOUNT_STATUSES = ['SUSPENDED', 'INACTIVE'] as const;
/** Super Admin accounts are never deletable; only Admin and Operator staff accounts are. */
export const DELETABLE_STAFF_ROLES = ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR'] as const;
const EMPLOYER_USER_TYPES = ['EMPLOYER_ADMIN', 'EMPLOYER_RECRUITER'] as const;

export const ACCOUNT_DELETED_AUDIT_ACTIONS: Record<DeletableAccountKind, string> = {
  CANDIDATE: 'DELETE_CANDIDATE',
  EMPLOYER: 'DELETE_EMPLOYER',
  ADMIN: 'DELETE_ADMIN',
};

export type AccountDeletionPreview = {
  kind: DeletableAccountKind;
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  role: string;
  accountStatus: string;
  deletable: boolean;
  blockers: string[];
  /** Records permanently removed together with the account. */
  related: Array<{ label: string; count: number }>;
  /** Records deliberately kept. */
  retained: string[];
};

export function isDeletableStatus(status: string | null | undefined): boolean {
  return (DELETABLE_ACCOUNT_STATUSES as readonly string[]).includes(String(status));
}

const NOT_SUSPENDED_MESSAGE =
  'Only suspended or inactive accounts can be deleted. Suspend or deactivate the account first.';

export function accountStatusBlocker(status: string | null | undefined): string | null {
  return isDeletableStatus(status) ? null : NOT_SUSPENDED_MESSAGE;
}

function fullName(first?: string | null, last?: string | null) {
  return [first, last].filter(Boolean).join(' ') || '—';
}

function conflict(message: string) {
  return new ConflictException({ code: ErrorCode.BUSINESS_RULE_VIOLATION, message });
}

function notFound(message: string) {
  return new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message });
}

const RETAINED_AUDIT = 'Audit log history (including this deletion)';

/**
 * Super Admin permanent deletion of suspended/inactive candidate, employer and staff accounts.
 * Database cascades remove the account's own records; rows without a foreign key (match scores
 * and search vectors) are removed explicitly so nothing orphaned stays searchable.
 */
@Injectable()
export class AdminAccountDeletionService {
  private readonly logger = new Logger(AdminAccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly storage?: StorageService,
  ) {}

  /* ---------- candidates ---------- */

  private async loadCandidate(id: string) {
    const row = await this.prisma.candidate.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        user: { select: { email: true, status: true, userType: true } },
        resumes: { select: { id: true, pdfStoragePath: true, sourceStoragePath: true } },
        _count: {
          select: {
            applications: true,
            resumes: true,
            employerInterviews: true,
            interviews: true,
            humanMockInterviews: true,
            skillAssessments: true,
            savedJobs: true,
          },
        },
      },
    });
    if (!row || row.user.userType !== 'CANDIDATE') throw notFound('Candidate not found');
    return row;
  }

  async candidatePreview(id: string): Promise<AccountDeletionPreview> {
    const row = await this.loadCandidate(id);
    const blockers = [accountStatusBlocker(row.user.status)].filter((b): b is string => Boolean(b));
    return {
      kind: 'CANDIDATE',
      id: row.id,
      userId: row.userId,
      displayName: fullName(row.firstName, row.lastName),
      email: row.user.email,
      role: 'CANDIDATE',
      accountStatus: row.user.status,
      deletable: blockers.length === 0,
      blockers,
      related: [
        { label: 'Job applications', count: row._count.applications },
        { label: 'Employer interviews', count: row._count.employerInterviews },
        { label: 'Resumes', count: row._count.resumes },
        { label: 'AI mock interviews', count: row._count.interviews },
        { label: 'Human mock interviews', count: row._count.humanMockInterviews },
        { label: 'Skill assessments', count: row._count.skillAssessments },
        { label: 'Saved jobs', count: row._count.savedJobs },
      ],
      retained: [RETAINED_AUDIT, 'Employer payment records (hiring fees stay with the employer)'],
    };
  }

  async deleteCandidate(actorId: string, id: string) {
    const preview = await this.candidatePreview(id);
    if (!preview.deletable) throw conflict(preview.blockers.join(' '));
    const row = await this.loadCandidate(id);
    const resumeIds = row.resumes.map((r) => r.id);
    const entityIds = [row.id, ...resumeIds];

    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.user.deleteMany({
        where: { id: row.userId, userType: 'CANDIDATE', status: { in: [...DELETABLE_ACCOUNT_STATUSES] } },
      });
      if (removed.count !== 1) throw conflict('The account status changed. Refresh and try again.');
      await tx.candidateMatch.deleteMany({ where: { candidateId: row.id } });
      await tx.embeddingChunk.deleteMany({
        where: { OR: [{ candidateId: row.id }, ...(resumeIds.length ? [{ resumeId: { in: resumeIds } }] : [])] },
      });
      await tx.profileEmbedding.deleteMany({ where: { entityId: { in: entityIds } } });
      await tx.embedding.deleteMany({ where: { entityId: { in: entityIds } } });
      await tx.auditLog.create({ data: this.auditData(actorId, preview) });
    });

    const files = row.resumes.flatMap((r) => [r.pdfStoragePath, r.sourceStoragePath]);
    try {
      files.push(...canonicalProfilePhotoPaths(row.id));
    } catch {
      // Non-UUID ids never had a canonical photo key.
    }
    await this.removeFiles(files);
    return this.result(preview);
  }

  /* ---------- employers ---------- */

  private async loadEmployer(id: string) {
    const row = await this.prisma.employer.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        companyName: true,
        user: { select: { email: true, status: true, userType: true } },
        jobs: { select: { id: true } },
        _count: { select: { jobs: true, interviews: true, hiringOutcomes: true, payments: true } },
      },
    });
    if (!row || !(EMPLOYER_USER_TYPES as readonly string[]).includes(row.user.userType)) {
      throw notFound('Employer not found');
    }
    return row;
  }

  async employerPreview(id: string): Promise<AccountDeletionPreview> {
    const row = await this.loadEmployer(id);
    const [applications, chargedPayments] = await Promise.all([
      this.prisma.application.count({ where: { job: { employerId: row.id } } }),
      this.prisma.employerPayment.count({ where: { employerId: row.id, amountPaise: { gt: 0 } } }),
    ]);
    const blockers = [
      accountStatusBlocker(row.user.status),
      chargedPayments > 0
        ? `This employer has ${chargedPayments} payment record(s) with a charged amount. Deleting the account would erase revenue history, so it cannot be deleted.`
        : null,
    ].filter((b): b is string => Boolean(b));
    return {
      kind: 'EMPLOYER',
      id: row.id,
      userId: row.userId,
      displayName: row.companyName,
      email: row.user.email,
      role: row.user.userType,
      accountStatus: row.user.status,
      deletable: blockers.length === 0,
      blockers,
      related: [
        { label: 'Jobs', count: row._count.jobs },
        { label: 'Candidate applications to these jobs', count: applications },
        { label: 'Interviews', count: row._count.interviews },
        { label: 'Hiring outcomes', count: row._count.hiringOutcomes },
        { label: 'Free (₹0) payment records', count: row._count.payments },
      ],
      retained: [RETAINED_AUDIT, 'Candidate accounts (only their applications to these jobs are removed)'],
    };
  }

  async deleteEmployer(actorId: string, id: string) {
    const preview = await this.employerPreview(id);
    if (!preview.deletable) throw conflict(preview.blockers.join(' '));
    const row = await this.loadEmployer(id);
    const jobIds = row.jobs.map((j) => j.id);

    await this.prisma.$transaction(async (tx) => {
      // Re-checked inside the transaction so a payment recorded after the preview still blocks deletion.
      const charged = await tx.employerPayment.count({ where: { employerId: row.id, amountPaise: { gt: 0 } } });
      if (charged > 0) throw conflict('A charged payment was recorded for this employer. It cannot be deleted.');
      const removed = await tx.user.deleteMany({
        where: {
          id: row.userId,
          userType: { in: [...EMPLOYER_USER_TYPES] },
          status: { in: [...DELETABLE_ACCOUNT_STATUSES] },
        },
      });
      if (removed.count !== 1) throw conflict('The account status changed. Refresh and try again.');
      if (jobIds.length) {
        await tx.embeddingChunk.deleteMany({ where: { jobId: { in: jobIds } } });
        await tx.profileEmbedding.deleteMany({ where: { entityId: { in: jobIds } } });
        await tx.embedding.deleteMany({ where: { entityId: { in: jobIds } } });
      }
      await tx.auditLog.create({ data: this.auditData(actorId, preview) });
    });

    try {
      await this.removeFiles(canonicalCompanyLogoPaths(row.id));
    } catch {
      // Non-UUID ids never had a canonical logo key.
    }
    return this.result(preview);
  }

  /* ---------- staff ---------- */

  private async loadAdmin(id: string) {
    const row = await this.prisma.admin.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        email: true,
        fullName: true,
        status: true,
        user: { select: { status: true, userType: true } },
      },
    });
    if (!row) throw notFound('Admin not found');
    return row;
  }

  async adminPreview(actorId: string, id: string): Promise<AccountDeletionPreview> {
    const row = await this.loadAdmin(id);
    const role = row.user.userType;
    // Both the staff profile and the login must be out of use.
    const status = isDeletableStatus(row.status) && isDeletableStatus(row.user.status) ? row.status : 'ACTIVE';
    const blockers = [
      row.userId === actorId ? 'You cannot delete your own account.' : null,
      (DELETABLE_STAFF_ROLES as readonly string[]).includes(role) ? null : 'Super Admin accounts cannot be deleted.',
      accountStatusBlocker(status),
    ].filter((b): b is string => Boolean(b));
    return {
      kind: 'ADMIN',
      id: row.id,
      userId: row.userId,
      displayName: row.fullName || row.email,
      email: row.email,
      role,
      accountStatus: row.status,
      deletable: blockers.length === 0,
      blockers,
      related: [{ label: 'Staff login and sessions', count: 1 }],
      retained: [RETAINED_AUDIT, 'Actions this staff member performed stay in the audit log'],
    };
  }

  async deleteAdmin(actorId: string, id: string) {
    const preview = await this.adminPreview(actorId, id);
    if (!preview.deletable) throw conflict(preview.blockers.join(' '));
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.user.deleteMany({
        where: {
          id: preview.userId,
          userType: { in: [...DELETABLE_STAFF_ROLES] },
          status: { in: [...DELETABLE_ACCOUNT_STATUSES] },
        },
      });
      if (removed.count !== 1) throw conflict('The account status changed. Refresh and try again.');
      await tx.auditLog.create({ data: this.auditData(actorId, preview) });
    });
    return this.result(preview);
  }

  /* ---------- shared ---------- */

  private auditData(actorId: string, preview: AccountDeletionPreview) {
    return {
      userId: actorId,
      action: ACCOUNT_DELETED_AUDIT_ACTIONS[preview.kind],
      resourceType: preview.kind,
      resourceId: preview.id,
      oldValue: JSON.stringify({
        userId: preview.userId,
        name: preview.displayName,
        email: preview.email,
        role: preview.role,
        status: preview.accountStatus,
      }),
      newValue: JSON.stringify({
        deleted: true,
        removed: Object.fromEntries(preview.related.map((r) => [r.label, r.count])),
      }),
    };
  }

  private result(preview: AccountDeletionPreview) {
    return { deleted: true, kind: preview.kind, id: preview.id, displayName: preview.displayName };
  }

  /** Best effort after the database commit; a storage failure never undoes the deletion. */
  private async removeFiles(paths: Array<string | null | undefined>) {
    if (!this.storage?.isConfigured()) return;
    for (const path of new Set(paths.filter((p): p is string => Boolean(p)))) {
      const ok = await this.storage.deleteFile(path).catch(() => false);
      if (!ok) this.logger.warn('Could not remove a stored file for a deleted account.');
    }
  }
}
