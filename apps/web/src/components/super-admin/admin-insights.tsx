'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import {
  getAdminApplicationPipeline,
  getAdminRevenue,
  mergeAdminSkill,
  type AdminApplicationPipeline,
  type AdminFunnelStage,
  type AdminRevenue,
  type AdminWhatsAppDelivery,
} from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

function rate(value: number | null | undefined) {
  return value == null ? '—' : `${value}%`;
}

function inr(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

type TileTone = 'default' | 'brand' | 'muted' | 'danger';

const TILE_TONE_CLASS: Record<TileTone, string> = {
  default: 'sa-ink',
  brand: 'sa-brand-text',
  muted: 'sa-muted',
  danger: 'sa-error-text',
};

function Tile({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: TileTone }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <p className="sa-label">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums [overflow-wrap:anywhere] ${TILE_TONE_CLASS[tone]}`}>{value}</p>
    </div>
  );
}

export function FunnelConversionPanel({ funnel }: { funnel: AdminFunnelStage[] }) {
  if (funnel.length === 0) return null;
  return (
    <section className="sa-card overflow-hidden" aria-labelledby="admin-funnel-title">
      <div className="sa-soft-h px-4 py-3">
        <h2 id="admin-funnel-title" className="text-sm font-bold uppercase tracking-wide">
          Hiring funnel &amp; conversion rates
        </h2>
      </div>
      <ol className="sa-gridlines grid gap-px sm:grid-cols-2 lg:grid-cols-5">
        {funnel.map((stage) => (
          <li key={stage.stage} className="px-3 py-3">
            <p className="sa-label">{stage.stage}</p>
            <p className="sa-value mt-1 text-2xl">{stage.count}</p>
            <p className="sa-muted mt-1 text-xs">
              {stage.conversionRate == null ? (
                'Top of funnel'
              ) : (
                <>
                  <span className="sa-brand-text font-bold">{rate(stage.conversionRate)}</span> {stage.basis}
                </>
              )}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RevenuePanel() {
  const [data, setData] = useState<AdminRevenue | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAdminRevenue()
      .then((next) => active && setData(next))
      .catch((err) => active && setError(userFacingError(err, 'load revenue')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="sa-card overflow-hidden" aria-labelledby="admin-revenue-title">
      <div className="sa-soft-h px-4 py-3">
        <h2 id="admin-revenue-title" className="text-sm font-bold uppercase tracking-wide">
          Revenue &amp; credits{data ? ` · ${data.period}` : ''}
        </h2>
      </div>
      {loading ? (
        <p className="sa-muted p-4 text-sm">Loading revenue…</p>
      ) : error ? (
        <p role="alert" className="sa-error-text p-4 text-sm">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="sa-gridlines grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total revenue" value={inr(data.totalRevenueInr)} tone="brand" />
            <Tile label="Revenue this month" value={inr(data.revenueThisMonthInr)} tone="brand" />
            <Tile label="Paid payments" value={data.paidPayments} />
            <Tile label="Pending payments" value={data.pendingPayments} tone="muted" />
            <Tile label="Paying employers" value={data.payingEmployers} />
            <Tile label="New employers this month" value={data.newEmployersThisMonth} />
            <Tile label="Candidate views used this month" value={data.creditsConsumedThisMonth} />
          </div>
          {data.bySource ? (
            <div className="border-t border-[var(--sa-line)]" data-testid="revenue-by-source">
              <p className="sa-label px-4 pt-3">Paid revenue by source</p>
              <div className="sa-gridlines mt-2 grid gap-px sm:grid-cols-3">
                <Tile label="Job posting fees" value={inr(data.bySource.jobPostingFeesInr)} tone="brand" />
                <Tile label="Hiring fees" value={inr(data.bySource.hiringFeesInr)} tone="brand" />
                <Tile label="Other paid revenue" value={inr(data.bySource.otherInr)} tone="brand" />
              </div>
            </div>
          ) : null}
          <div className="sa-muted space-y-1 px-4 py-3 text-xs">
            {data.definition ? <p>{data.definition}</p> : null}
            {data.excluded ? (
              <p data-testid="revenue-excluded">
                Not counted: pending {inr(data.excluded.pending.amountInr)} ({data.excluded.pending.count}) · failed{' '}
                {inr(data.excluded.failed.amountInr)} ({data.excluded.failed.count}) · refunded{' '}
                {inr(data.excluded.refunded.amountInr)} ({data.excluded.refunded.count})
                {data.freePaidPayments ? ` · ${data.freePaidPayments} free (₹0) paid records` : ''}.
              </p>
            ) : null}
            {!data.paymentGatewayConfigured && <p>{data.note}</p>}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function WhatsAppDeliveryPanel({ delivery }: { delivery: AdminWhatsAppDelivery | null | undefined }) {
  if (!delivery) {
    return (
      <p className="sa-card sa-muted px-4 py-3 text-sm">WhatsApp delivery metrics are unavailable right now.</p>
    );
  }
  return (
    <section className="sa-card overflow-hidden" aria-labelledby="admin-wa-delivery-title">
      <div className="sa-panel-h px-4 py-2 text-sm" id="admin-wa-delivery-title">
        WhatsApp delivery · last {delivery.windowDays} days
      </div>
      <div className="sa-gridlines grid gap-px sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Sent" value={delivery.sent} />
        <Tile label="Delivered" value={delivery.delivered} tone="brand" />
        <Tile label="Read" value={delivery.read} tone="brand" />
        <Tile label="Failed" value={delivery.failed} tone="danger" />
        <Tile label="Queued" value={delivery.pending} tone="muted" />
        <Tile label="Delivery rate" value={rate(delivery.deliveryRate)} tone="brand" />
      </div>
      <div className="border-t border-[var(--sa-line)] px-4 py-3">
        <h3 className="sa-label text-xs">Recent failures</h3>
        {delivery.recentFailures.length === 0 ? (
          <p className="sa-muted mt-2 text-sm">No failed messages in this period.</p>
        ) : (
          <ul className="sa-rows mt-2">
            {delivery.recentFailures.map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <p className="sa-ink font-semibold">{f.template || 'Message'}</p>
                <p className="sa-error-text text-xs">{f.reason}</p>
                <p className="sa-muted text-xs">{new Date(f.createdAt).toLocaleString('en-IN')}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ApplicationPipelinePanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [data, setData] = useState<AdminApplicationPipeline | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    getAdminApplicationPipeline()
      .then((next) => active && setData(next))
      .catch((err) => active && setError(userFacingError(err, 'load the application pipeline')));
    return () => {
      active = false;
    };
  }, [refreshKey]);

  if (error) {
    return (
      <p role="alert" className="sa-notice sa-notice--error px-4 py-3 text-sm">
        {error}
      </p>
    );
  }
  if (!data) return <p className="sa-muted text-sm">Loading pipeline…</p>;
  return (
    <section className="sa-card overflow-hidden" aria-labelledby="admin-pipeline-title">
      <div className="sa-panel-h flex items-center justify-between gap-2 px-4 py-2 text-sm">
        <h2 id="admin-pipeline-title">Application pipeline</h2>
        <span>{data.total} total</span>
      </div>
      <ol className="sa-gridlines grid gap-px sm:grid-cols-5">
        {data.stages.map((stage) => (
          <li key={stage.stage} className="px-3 py-3 text-center">
            <p className="sa-value text-2xl">{stage.count}</p>
            <p className="sa-label">{stage.stage}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export type CandidateFilters = { location: string; skill: string; from: string; to: string };

export const EMPTY_CANDIDATE_FILTERS: CandidateFilters = { location: '', skill: '', from: '', to: '' };

export function CandidateFilterBar({
  value,
  onApply,
}: {
  value: CandidateFilters;
  onApply: (next: CandidateFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const id = useId();

  useEffect(() => setDraft(value), [value]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (draft.from && draft.to && draft.to < draft.from) {
      setError('The end date must be on or after the start date.');
      return;
    }
    setError('');
    onApply({
      location: draft.location.trim(),
      skill: draft.skill.trim(),
      from: draft.from,
      to: draft.to,
    });
  }

  const field = 'sa-input px-3 py-2 text-sm';
  return (
    <form onSubmit={submit} className="sa-card p-3" aria-label="Candidate filters">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="sa-ink text-xs font-bold" htmlFor={`${id}-location`}>
          Location
          <input
            id={`${id}-location`}
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="City or state"
            className={`${field} mt-1 w-full font-normal`}
          />
        </label>
        <label className="sa-ink text-xs font-bold" htmlFor={`${id}-skill`}>
          Skill
          <input
            id={`${id}-skill`}
            value={draft.skill}
            onChange={(e) => setDraft({ ...draft, skill: e.target.value })}
            placeholder="e.g. Excel"
            className={`${field} mt-1 w-full font-normal`}
          />
        </label>
        <label className="sa-ink text-xs font-bold" htmlFor={`${id}-from`}>
          Registered from
          <input
            id={`${id}-from`}
            type="date"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            className={`${field} mt-1 w-full font-normal`}
            aria-invalid={Boolean(error)}
          />
        </label>
        <label className="sa-ink text-xs font-bold" htmlFor={`${id}-to`}>
          Registered to
          <input
            id={`${id}-to`}
            type="date"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            className={`${field} mt-1 w-full font-normal`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button type="submit" className="sa-btn">
            Apply filters
          </button>
          <button
            type="button"
            className="sa-btn sa-btn--line"
            onClick={() => {
              setError('');
              onApply(EMPTY_CANDIDATE_FILTERS);
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="sa-error-text mt-2 text-sm">
          {error}
        </p>
      )}
    </form>
  );
}

export function SkillMergeControl({
  source,
  skills,
  onMerged,
  onError,
}: {
  source: { id: string; name: string };
  skills: Array<{ id: string; name: string; active: boolean }>;
  onMerged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const selectId = useId();
  const targets = skills.filter((s) => s.id !== source.id && s.active);
  const target = targets.find((s) => s.id === targetId);

  async function merge() {
    if (!target) return;
    setBusy(true);
    try {
      const result = await mergeAdminSkill(source.id, target.id);
      setConfirming(false);
      setOpen(false);
      setTargetId('');
      onMerged(
        `Merged "${source.name}" into "${result.target.name}": ${result.candidatesUpdated} candidate skill(s) and ${result.jobsUpdated} job(s) updated.`,
      );
    } catch (err) {
      setConfirming(false);
      onError(userFacingError(err, 'merge the skill'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="sa-act sa-act--line"
        disabled={targets.length === 0}
        onClick={() => setOpen(true)}
      >
        Merge
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label htmlFor={selectId} className="sr-only">
        Merge {source.name} into
      </label>
      <select
        id={selectId}
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
        className="sa-input min-h-8 px-2 py-1 text-xs"
      >
        <option value="">Merge into…</option>
        {targets.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="sa-act"
        disabled={!target || busy}
        onClick={() => setConfirming(true)}
      >
        Merge
      </button>
      <button
        type="button"
        className="sa-act sa-act--line"
        onClick={() => {
          setOpen(false);
          setTargetId('');
        }}
      >
        Cancel
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Merge "${source.name}" into "${target?.name ?? ''}"?`}
        message={`Candidates and jobs using "${source.name}" will use "${target?.name ?? ''}" instead, "${source.name}" becomes an alias, and "${source.name}" is deactivated.`}
        confirmLabel="Merge skills"
        destructive
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={merge}
      />
    </div>
  );
}
