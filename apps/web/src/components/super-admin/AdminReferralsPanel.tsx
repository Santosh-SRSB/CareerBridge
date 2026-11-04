'use client';

import { useEffect, useState } from 'react';
import {
  getAdminReferrals,
  reviewAdminReferral,
  reviewAdminReferralPayout,
  type AdminReferralsBoard,
} from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';
import { ActionBtn, StatusPill } from '@/components/super-admin/admin-tab-ui';

export function AdminReferralsPanel() {
  const [board, setBoard] = useState<AdminReferralsBoard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      setBoard(await getAdminReferrals());
    } catch (err) {
      setError(userFacingError(err, 'load referrals'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function run(id: string, action: () => Promise<unknown>, ok: string) {
    setBusyId(id);
    setNotice('');
    setError('');
    try {
      await action();
      setNotice(ok);
      await reload();
    } catch (err) {
      setError(userFacingError(err, 'update referral'));
    } finally {
      setBusyId('');
    }
  }

  function markPaid(id: string) {
    const paymentReference = window.prompt('UPI payment reference / UTR');
    if (!paymentReference?.trim()) return;
    void run(
      id,
      () => reviewAdminReferralPayout(id, 'PAID', { paymentReference: paymentReference.trim() }),
      'Marked paid.',
    );
  }

  return (
    <div className="space-y-5">
      {loading && !board ? <p className="sa-muted text-sm">Loading referrals…</p> : null}
      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
      {notice ? <p className="text-sm font-semibold text-emerald-700">{notice}</p> : null}

      {board ? (
        <>
          <section className="sa-card p-4">
            <p className="sa-label text-xs">Campaign</p>
            <h2 className="sa-ink mt-1 text-lg font-extrabold">{board.campaign.name}</h2>
            <p className="sa-muted mt-1 text-xs">
              Fresher {board.campaign.fresherBatchSize} register+login →{' '}
              {board.campaign.fresherPointsPerBatch ?? board.campaign.pointsPerBatch} pts · Experienced{' '}
              {board.campaign.experiencedBatchSize} register+login →{' '}
              {board.campaign.experiencedPointsPerBatch ?? 5} pts · UPI at{' '}
              {board.campaign.pointsToPayoutEligible} pts · {board.campaign.status}
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="sa-ink text-sm font-extrabold">UPI payout requests</h3>
            {board.payouts.length === 0 ? (
              <p className="sa-empty p-4 text-sm">No payout requests yet.</p>
            ) : (
              board.payouts.map((p) => (
                <article key={p.id} className="sa-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="sa-ink font-bold">{p.referrer.name}</p>
                      <p className="sa-muted text-xs">
                        {p.referrer.phone || p.referrer.email || '—'} · {p.upiId} · {p.pointsAtRequest}{' '}
                        points
                      </p>
                    </div>
                    <StatusPill status={p.status} />
                  </div>
                  {p.status === 'PENDING' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionBtn disabled={busyId === p.id} onClick={() => markPaid(p.id)}>
                        Mark paid
                      </ActionBtn>
                      <ActionBtn
                        tone="strong"
                        disabled={busyId === p.id}
                        onClick={() =>
                          void run(p.id, () => reviewAdminReferralPayout(p.id, 'REJECT'), 'Payout rejected.')
                        }
                      >
                        Reject
                      </ActionBtn>
                    </div>
                  ) : p.paymentReference ? (
                    <p className="sa-muted mt-2 text-xs">Ref: {p.paymentReference}</p>
                  ) : null}
                </article>
              ))
            )}
          </section>

          <section className="space-y-3">
            <h3 className="sa-ink text-sm font-extrabold">Attributed referrals</h3>
            {board.referrals.length === 0 ? (
              <p className="sa-empty p-4 text-sm">No referrals yet.</p>
            ) : (
              board.referrals.map((r) => (
                <article key={r.id} className="sa-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="sa-ink font-bold">
                        {r.referrer.name} → {r.referred.name}
                      </p>
                      <p className="sa-muted text-xs">
                        Code {r.referralCode} · Referrer {r.referrer.kind} ·{' '}
                        {new Date(r.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </div>
                  {r.status !== 'APPROVED' && r.status !== 'REJECTED' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionBtn
                        disabled={busyId === r.id}
                        onClick={() =>
                          void run(r.id, () => reviewAdminReferral(r.id, 'APPROVE'), 'Referral approved.')
                        }
                      >
                        Approve
                      </ActionBtn>
                      <ActionBtn
                        tone="strong"
                        disabled={busyId === r.id}
                        onClick={() =>
                          void run(
                            r.id,
                            () => reviewAdminReferral(r.id, 'REJECT', 'Rejected by admin'),
                            'Referral rejected.',
                          )
                        }
                      >
                        Reject
                      </ActionBtn>
                      <ActionBtn
                        disabled={busyId === r.id}
                        onClick={() =>
                          void run(r.id, () => reviewAdminReferral(r.id, 'HOLD', 'On hold'), 'Referral on hold.')
                        }
                      >
                        Hold
                      </ActionBtn>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
