'use client';

import { useEffect, useState } from 'react';
import { getAdminCandidateProgress, getAdminEmployerProgress } from '@/lib/api';
import {
  type AdminProgressReport,
  PROGRESS_PIE_SIZE,
  buildProgressPie,
  progressCaption,
  progressPieSummary,
  progressShareLabel,
  progressViewState,
} from '@/lib/admin-progress';
import { userFacingError } from '@/lib/client-errors';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/StateViews';

type Props = {
  title: string;
  noun: string;
  testId: string;
  load: () => Promise<AdminProgressReport>;
};

function ProgressPieSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div role="status" aria-live="polite" data-state="loading" className="flex flex-col items-center gap-4 p-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="cb-skeleton aspect-square w-full max-w-[220px] animate-pulse rounded-full bg-[var(--sa-tint2)]" />
      <div className="w-full space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </div>
  );
}

function ProgressPiePanel({ title, noun, testId, load }: Props) {
  const [data, setData] = useState<AdminProgressReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const headingId = `${testId}-title`;

  useEffect(() => {
    let active = true;
    load()
      .then((next) => active && setData(next))
      .catch((err) => active && setError(userFacingError(err, `load ${title.toLowerCase()}`)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load, title, attempt]);

  const retry = () => {
    setLoading(true);
    setError('');
    setAttempt((n) => n + 1);
  };
  const state = progressViewState({ loading, error, report: data });
  const pie = state === 'ready' && data ? buildProgressPie(data.stages) : null;
  const dim = (key: string) => activeKey !== null && activeKey !== key;

  return (
    <section
      className="sa-card flex h-full min-w-0 flex-col overflow-hidden"
      aria-labelledby={headingId}
      data-testid={testId}
      data-state={state}
    >
      <div className="sa-soft-h flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
        <h2 id={headingId} className="text-sm font-bold uppercase tracking-wide">
          {title}
        </h2>
        {data && state !== 'error' ? <p className="sa-muted text-xs">{progressCaption(data, noun)}</p> : null}
      </div>
      {state === 'loading' ? (
        <ProgressPieSkeleton label={`Loading ${title.toLowerCase()}…`} rows={data?.stages.length || 5} />
      ) : state === 'error' ? (
        <ErrorState className="m-4" message={error} onRetry={retry} />
      ) : state === 'empty' ? (
        <EmptyState className="m-4" title="No progress data available yet." />
      ) : pie && data ? (
        <div className="flex flex-col items-center gap-4 p-4">
          <svg
            viewBox={`0 0 ${PROGRESS_PIE_SIZE} ${PROGRESS_PIE_SIZE}`}
            className="h-auto w-full max-w-[220px]"
            role="img"
            aria-label={progressPieSummary(title, data.stages)}
            data-testid="progress-pie"
          >
            {pie.slices.map((slice) =>
              slice.path ? (
                <path
                  key={slice.key}
                  d={slice.path}
                  fill={slice.color}
                  stroke="#fff"
                  strokeWidth={1.5}
                  opacity={dim(slice.key) ? 0.35 : 1}
                  data-slice={slice.key}
                  data-count={slice.count}
                  onMouseEnter={() => setActiveKey(slice.key)}
                  onMouseLeave={() => setActiveKey(null)}
                >
                  <title>{`${slice.label}: ${slice.count} ${noun} (${slice.share}% of chart)`}</title>
                </path>
              ) : null,
            )}
            {pie.slices.map((slice) =>
              slice.labelPoint ? (
                <text
                  key={slice.key}
                  x={slice.labelPoint.x}
                  y={slice.labelPoint.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none fill-white text-[11px] font-bold"
                  aria-hidden="true"
                  opacity={dim(slice.key) ? 0.35 : 1}
                >
                  {`${Math.round(slice.share)}%`}
                </text>
              ) : null,
            )}
          </svg>
          <ol className="sa-rows w-full" data-testid="progress-legend">
            {data.stages.map((stage, index) => {
              const slice = pie.slices[index]!;
              return (
                <li
                  key={stage.key}
                  data-stage={stage.key}
                  title={[stage.definition, stage.detail, progressShareLabel(stage, noun)].filter(Boolean).join(' · ')}
                  className="flex items-center gap-2 py-1.5 text-sm"
                  style={{ opacity: dim(stage.key) ? 0.5 : 1 }}
                  onMouseEnter={() => setActiveKey(stage.key)}
                  onMouseLeave={() => setActiveKey(null)}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} aria-hidden="true" />
                  <span className="sa-muted w-4 shrink-0 text-xs font-extrabold">{index + 1}</span>
                  <span className="sa-ink min-w-0 flex-1 font-semibold" data-testid="stage-label">
                    {stage.label}
                  </span>
                  <span className="sa-muted shrink-0 text-xs tabular-nums">{slice.share}%</span>
                  <span className="sa-value w-12 shrink-0 text-right text-base" data-testid="stage-count">
                    {stage.count}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="sa-muted w-full text-xs">
            Slices compare stage counts; one {noun.replace(/s$/, '')} can appear in several stages.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function CandidateProgressPanel() {
  return (
    <ProgressPiePanel
      title="Candidate Progress"
      noun="candidates"
      testId="candidate-progress"
      load={getAdminCandidateProgress}
    />
  );
}

export function EmployerProgressPanel() {
  return (
    <ProgressPiePanel
      title="Employer Progress"
      noun="employers"
      testId="employer-progress"
      load={getAdminEmployerProgress}
    />
  );
}
