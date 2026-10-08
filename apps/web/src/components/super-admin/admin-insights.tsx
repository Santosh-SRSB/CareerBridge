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

function Tile({ label, value, tone = '#2255a4' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="border border-[#e5e5e5] bg-white px-3 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[#666]">{label}</p>
      <p className="mt-1 text-xl font-black" style={{ color: tone }}>
        {value}
      </p>
    </div>
  );
}

export function FunnelConversionPanel({ funnel }: { funnel: AdminFunnelStage[] }) {
  if (funnel.length === 0) return null;
  return (
    <section className="border border-[#ddd] bg-white" aria-labelledby="admin-funnel-title">
      <div className="border-b border-[#eee] bg-[#1f9d6814] px-4 py-3">
        <h2 id="admin-funnel-title" className="text-sm font-bold uppercase tracking-wide text-[#16774f]">
          Hiring funnel &amp; conversion rates
        </h2>
      </div>
      <ol className="grid gap-px bg-[#eee] sm:grid-cols-2 lg:grid-cols-5">
        {funnel.map((stage) => (
          <li key={stage.stage} className="bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#666]">{stage.stage}</p>
            <p className="mt-1 text-2xl font-black text-[#333]">{stage.count}</p>
            <p className="mt-1 text-xs text-[#555]">
              {stage.conversionRate == null ? (
                'Top of funnel'
              ) : (
                <>
                  <span className="font-bold text-[#16774f]">{rate(stage.conversionRate)}</span> {stage.basis}
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
    <section className="border border-[#ddd] bg-white" aria-labelledby="admin-revenue-title">
      <div className="border-b border-[#eee] bg-[#852b9914] px-4 py-3">
        <h2 id="admin-revenue-title" className="text-sm font-bold uppercase tracking-wide text-[#6b2080]">
          Revenue &amp; credits{data ? ` · ${data.period}` : ''}
        </h2>
      </div>
      {loading ? (
        <p className="p-4 text-sm text-[#666]">Loading revenue…</p>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-[#b42318]">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="grid gap-px bg-[#eee] sm:grid-cols-2 lg:grid-cols-4">
            <Tile label="Total revenue" value={inr(data.totalRevenueInr)} tone="#6b2080" />
            <Tile label="Revenue this month" value={inr(data.revenueThisMonthInr)} tone="#6b2080" />
            <Tile label="Paid payments" value={data.paidPayments} />
            <Tile label="Pending payments" value={data.pendingPayments} tone="#9a6700" />
            <Tile label="Paying employers" value={data.payingEmployers} />
            <Tile label="New employers this month" value={data.newEmployersThisMonth} />
            <Tile label="Candidate views used this month" value={data.creditsConsumedThisMonth} />
          </div>
          {data.bySource ? (
            <div className="border-t border-[#eee]" data-testid="revenue-by-source">
              <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-wide text-[#6b2080]">
                Paid revenue by source
              </p>
              <div className="mt-2 grid gap-px bg-[#eee] sm:grid-cols-3">
                <Tile label="Job posting fees" value={inr(data.bySource.jobPostingFeesInr)} tone="#6b2080" />
                <Tile label="Hiring fees" value={inr(data.bySource.hiringFeesInr)} tone="#6b2080" />
                <Tile label="Other paid revenue" value={inr(data.bySource.otherInr)} tone="#6b2080" />
              </div>
            </div>
          ) : null}
          <div className="space-y-1 px-4 py-3 text-xs text-[#555]">
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
      <p className="border border-[#c8eadb] bg-white px-4 py-3 text-sm text-[#555]">
        WhatsApp delivery metrics are unavailable right now.
      </p>
    );
  }
  return (
    <section className="border border-[#c8eadb] bg-white" aria-labelledby="admin-wa-delivery-title">
      <div className="bg-[#1b7f55] px-4 py-2 text-sm font-bold text-white" id="admin-wa-delivery-title">
        WhatsApp delivery · last {delivery.windowDays} days
      </div>
      <div className="grid gap-px bg-[#eaf7f1] sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Sent" value={delivery.sent} />
        <Tile label="Delivered" value={delivery.delivered} tone="#1b7f55" />
        <Tile label="Read" value={delivery.read} tone="#1b7f55" />
        <Tile label="Failed" value={delivery.failed} tone="#b42318" />
        <Tile label="Queued" value={delivery.pending} tone="#9a6700" />
        <Tile label="Delivery rate" value={rate(delivery.deliveryRate)} tone="#1b7f55" />
      </div>
      <div className="px-4 py-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[#555]">Recent failures</h3>
        {delivery.recentFailures.length === 0 ? (
          <p className="mt-2 text-sm text-[#555]">No failed messages in this period.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[#f3e1de]">
            {delivery.recentFailures.map((f) => (
              <li key={f.id} className="py-2 text-sm">
                <p className="font-semibold text-[#444]">{f.template || 'Message'}</p>
                <p className="text-xs text-[#b42318]">{f.reason}</p>
                <p className="text-xs text-[#666]">{new Date(f.createdAt).toLocaleString('en-IN')}</p>
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
      <p role="alert" className="border border-[#f3d5cb] bg-white px-4 py-3 text-sm text-[#b42318]">
        {error}
      </p>
    );
  }
  if (!data) return <p className="text-sm text-[#666]">Loading pipeline…</p>;
  return (
    <section className="border border-[#f3d5cb] bg-white" aria-labelledby="admin-pipeline-title">
      <div className="flex items-center justify-between bg-[#b8401f] px-4 py-2 text-sm font-bold text-white">
        <h2 id="admin-pipeline-title">Application pipeline</h2>
        <span>{data.total} total</span>
      </div>
      <ol className="grid gap-px bg-[#f3d5cb] sm:grid-cols-5">
        {data.stages.map((stage) => (
          <li key={stage.stage} className="bg-white px-3 py-3 text-center">
            <p className="text-2xl font-black text-[#333]">{stage.count}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#666]">{stage.stage}</p>
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

  const field = 'border border-[#ddd] bg-white px-3 py-2 text-sm';
  return (
    <form onSubmit={submit} className="border border-[#d5ebf6] bg-white p-3" aria-label="Candidate filters">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-xs font-bold text-[#555]" htmlFor={`${id}-location`}>
          Location
          <input
            id={`${id}-location`}
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="City or state"
            className={`${field} mt-1 w-full font-normal`}
          />
        </label>
        <label className="text-xs font-bold text-[#555]" htmlFor={`${id}-skill`}>
          Skill
          <input
            id={`${id}-skill`}
            value={draft.skill}
            onChange={(e) => setDraft({ ...draft, skill: e.target.value })}
            placeholder="e.g. Excel"
            className={`${field} mt-1 w-full font-normal`}
          />
        </label>
        <label className="text-xs font-bold text-[#555]" htmlFor={`${id}-from`}>
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
        <label className="text-xs font-bold text-[#555]" htmlFor={`${id}-to`}>
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
        <div className="flex items-end gap-2">
          <button type="submit" className="bg-[#1b7fb0] px-4 py-2 text-sm font-bold text-white">
            Apply filters
          </button>
          <button
            type="button"
            className="border border-[#ccc] bg-white px-4 py-2 text-sm font-bold text-[#444]"
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
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-[#b42318]">
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
        className="bg-[#5c1d6a] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
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
        className="border border-[#d8bde4] bg-white px-2 py-1 text-xs"
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
        className="bg-[#5c1d6a] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-40"
        disabled={!target || busy}
        onClick={() => setConfirming(true)}
      >
        Merge
      </button>
      <button
        type="button"
        className="border border-[#ccc] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#444]"
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
