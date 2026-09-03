import Link from 'next/link';
import type { JobCard } from '@careerbridge/shared';
import { formatJobType, formatSalary } from '@/lib/match';
import { MatchBadge } from '@/components/MatchBadge';

export function JobFeedCard({ job, cityFallback }: { job: JobCard; cityFallback?: string }) {
  const city = job.city || cityFallback;
  const companyMark = (job.companyName?.[0] || 'C').toUpperCase();

  return (
    <Link href={`/jobs/${job.id}`} className="cb-lift-card flex w-full min-w-0 flex-col p-4">
      <div className="cb-job-logo">{companyMark}</div>
      <h3 className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-snug text-primary">{job.title}</h3>
      <p className="mt-1 truncate text-sm text-muted">{job.companyName}</p>
      {job.match ? (
        <div className="mt-2">
          <MatchBadge score={job.match.score} />
        </div>
      ) : null}
      <div className="mt-auto pt-3">
        <p className="text-xs text-muted">{city || 'Location on request'}</p>
        <p className="mt-1 text-sm font-extrabold text-primary">{formatSalary(job.salaryMin, job.salaryMax)}</p>
        <p className="mt-2 text-xs font-bold text-teal">View role →</p>
      </div>
    </Link>
  );
}

export function JobListingCard({ job, cityFallback }: { job: JobCard; cityFallback?: string }) {
  const city = job.city || cityFallback;
  const companyMark = (job.companyName?.[0] || 'C').toUpperCase();

  return (
    <Link href={`/jobs/${job.id}`} className="cb-lift-card block p-4 transition hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-teal text-lg font-extrabold text-primary shadow-[0_8px_16px_rgba(10,46,44,0.14)]">
          {companyMark}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold leading-snug text-primary">{job.title}</h3>
            {job.verified ? (
              <span className="rounded-full bg-teal/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                Verified
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted">{job.companyName}</p>
          {job.match ? (
            <div className="mt-2">
              <MatchBadge score={job.match.score} />
            </div>
          ) : null}
          <p className="mt-2 text-sm text-muted">
            {city || 'Location on request'}
            {job.jobType ? ` · ${formatJobType(job.jobType)}` : ''}
          </p>
          <p className="mt-1 text-base font-bold text-primary">{formatSalary(job.salaryMin, job.salaryMax)}</p>
        </div>
      </div>
      <span className="mt-3 inline-flex h-8 items-center rounded-full bg-gradient-to-r from-[#ca8a04] to-[#eab308] px-3.5 text-xs font-extrabold text-navy">
        View &amp; apply
      </span>
    </Link>
  );
}
