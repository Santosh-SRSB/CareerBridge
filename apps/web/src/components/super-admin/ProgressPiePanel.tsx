'use client';

import { useEffect, useState } from 'react';
import { getAdminCandidateProgress, getAdminEmployerProgress } from '@/lib/api';
import {
  type AdminProgressReport,
  PROGRESS_BAR_VIEW,
  buildProgressBars,
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

function ProgressBarSkeleton({ label, rows }: { label: string; rows: number }) {
  return (
    <div role="status" aria-live="polite" data-state="loading" className="flex flex-col items-center gap-4 p-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex h-[180px] w-full max-w-[320px] items-end justify-between gap-2">
        {Array.from({ length: Math.min(rows, 7) }).map((_, i) => (
          <div
            key={i}
            className="cb-skeleton w-full animate-pulse rounded-t-md bg-[var(--sa-tint2)]"
            style={{ height: `${40 + ((i * 17) % 50)}%` }}
          />
        ))}
      </div>
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
  const chart = state === 'ready' && data ? buildProgressBars(data.stages) : null;
  const dim = (key: string) => activeKey !== null && activeKey !== key;
  const { width, height, padTop, padLeft, padRight, padBottom } = PROGRESS_BAR_VIEW;
  const plotBottom = height - padBottom;
  const gridLines = chart
    ? [0, 0.25, 0.5, 0.75, 1].map((t) => ({
        y: padTop + chart.plotHeight * (1 - t),
        label: chart.max ? Math.round(chart.max * t) : 0,
      }))
    : [];

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
        <ProgressBarSkeleton label={`Loading ${title.toLowerCase()}…`} rows={data?.stages.length || 5} />
      ) : state === 'error' ? (
        <ErrorState className="m-4" message={error} onRetry={retry} />
      ) : state === 'empty' ? (
        <EmptyState className="m-4" title="No progress data available yet." />
      ) : chart && data ? (
        <div className="flex flex-col items-center gap-4 p-4">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full max-w-[360px]"
            role="img"
            aria-label={progressPieSummary(title, data.stages)}
            data-testid="progress-bar"
          >
            {gridLines.map((line) => (
              <g key={line.y}>
                <line
                  x1={padLeft}
                  x2={width - padRight}
                  y1={line.y}
                  y2={line.y}
                  stroke="#d1d5db"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 6}
                  y={line.y}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-[var(--sa-muted,#6b7280)] text-[10px]"
                >
                  {line.label}
                </text>
              </g>
            ))}
            {chart.bars.map((bar, index) => {
              const y = plotBottom - bar.height;
              const h = Math.max(bar.height, 0);
              const r = Math.min(10, bar.width / 2, h);
              // Rounded top corners only (matches reference bar style).
              const d =
                h <= 0
                  ? ''
                  : [
                      `M ${bar.x} ${plotBottom}`,
                      `L ${bar.x} ${y + r}`,
                      `Q ${bar.x} ${y} ${bar.x + r} ${y}`,
                      `L ${bar.x + bar.width - r} ${y}`,
                      `Q ${bar.x + bar.width} ${y} ${bar.x + bar.width} ${y + r}`,
                      `L ${bar.x + bar.width} ${plotBottom}`,
                      'Z',
                    ].join(' ');
              return (
                <g key={bar.key}>
                  {h > 0 ? (
                    <path
                      d={d}
                      fill={bar.color}
                      stroke="#374151"
                      strokeWidth={1.25}
                      opacity={dim(bar.key) ? 0.35 : 1}
                      data-bar={bar.key}
                      data-count={bar.count}
                      onMouseEnter={() => setActiveKey(bar.key)}
                      onMouseLeave={() => setActiveKey(null)}
                    >
                      <title>{`${bar.label}: ${bar.count} ${noun} (${bar.share}% of chart)`}</title>
                    </path>
                  ) : null}
                  <text
                    x={bar.x + bar.width / 2}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-[var(--sa-muted,#6b7280)] text-[10px] font-bold"
                    opacity={dim(bar.key) ? 0.5 : 1}
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <ol className="sa-rows w-full" data-testid="progress-legend">
            {data.stages.map((stage, index) => {
              const bar = chart.bars[index]!;
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
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: bar.color }} aria-hidden="true" />
                  <span className="sa-muted w-4 shrink-0 text-xs font-extrabold">{index + 1}</span>
                  <span className="sa-ink min-w-0 flex-1 font-semibold" data-testid="stage-label">
                    {stage.label}
                  </span>
                  <span className="sa-muted shrink-0 text-xs tabular-nums">{bar.share}%</span>
                  <span className="sa-value w-12 shrink-0 text-right text-base" data-testid="stage-count">
                    {stage.count}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="sa-muted w-full text-xs">
            Bars compare stage counts; one {noun.replace(/s$/, '')} can appear in several stages.
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
