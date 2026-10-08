'use client';

import { useEffect, useState } from 'react';
import { getAdminCandidateProgress, getAdminEmployerProgress } from '@/lib/api';
import {
  type AdminProgressReport,
  progressBarWidth,
  progressCaption,
  progressShareLabel,
} from '@/lib/admin-progress';
import { userFacingError } from '@/lib/client-errors';

type Props = {
  title: string;
  noun: string;
  accent: string;
  ink: string;
  testId: string;
  load: () => Promise<AdminProgressReport>;
};

function ProgressFunnelPanel({ title, noun, accent, ink, testId, load }: Props) {
  const [data, setData] = useState<AdminProgressReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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
  }, [load, title]);

  return (
    <section className="border border-[#ddd] bg-white" aria-labelledby={headingId} data-testid={testId}>
      <div
        className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#eee] px-4 py-3"
        style={{ backgroundColor: `${accent}14` }}
      >
        <h2 id={headingId} className="text-sm font-bold uppercase tracking-wide" style={{ color: ink }}>
          {title}
        </h2>
        {data ? <p className="text-xs text-[#666]">{progressCaption(data, noun)}</p> : null}
      </div>
      {loading ? (
        <p className="p-4 text-sm text-[#666]">Loading {title.toLowerCase()}…</p>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-[#b42318]">
          {error}
        </p>
      ) : data ? (
        <ol className="divide-y divide-[#f0f0f0]">
          {data.stages.map((stage, index) => (
            <li
              key={stage.key}
              data-stage={stage.key}
              className="grid gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(160px,220px)_1fr_auto] sm:items-center"
            >
              <p className="text-sm font-bold text-[#333]">
                <span className="mr-2 text-xs font-black" style={{ color: accent }}>
                  {index + 1}
                </span>
                {stage.label}
              </p>
              <div className="h-3 overflow-hidden rounded bg-[#f1f1f1]" aria-hidden="true">
                <div
                  className="h-full rounded"
                  style={{ width: `${progressBarWidth(stage.count, data.registered)}%`, backgroundColor: accent }}
                />
              </div>
              <p className="text-right text-xl font-black tabular-nums text-[#333]" data-testid="stage-count">
                {stage.count}
              </p>
              <p className="text-xs text-[#666] sm:col-span-3">
                <span className="font-semibold" style={{ color: ink }}>
                  {progressShareLabel(stage, noun)}
                </span>
                {stage.detail ? ` · ${stage.detail}` : ''} · {stage.definition}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function CandidateProgressPanel() {
  return (
    <ProgressFunnelPanel
      title="Candidate progress"
      noun="candidates"
      accent="#0aa3c2"
      ink="#086f85"
      testId="candidate-progress"
      load={getAdminCandidateProgress}
    />
  );
}

export function EmployerProgressPanel() {
  return (
    <ProgressFunnelPanel
      title="Employer progress"
      noun="employers"
      accent="#1f9d68"
      ink="#16774f"
      testId="employer-progress"
      load={getAdminEmployerProgress}
    />
  );
}
