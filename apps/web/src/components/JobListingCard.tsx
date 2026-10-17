import Link from 'next/link';
import type { JobCard } from '@careerbridge/shared';
import { formatJobType, formatSalary } from '@/lib/match';
import { MatchBadge } from '@/components/MatchBadge';

export function JobFeedCard({ job, cityFallback }: { job: JobCard; cityFallback?: string }) {
  const city = job.city || cityFallback;
  const companyMark = (job.companyName?.[0] || 'C').toUpperCase();

  return (
    <div className="cb-lift-card flex w-full min-w-0 flex-col p-4">
      <Link href={`/jobs/${job.id}`} className="min-w-0 flex-1">
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
        </div>
      </Link>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-primary/30 text-xs font-extrabold text-primary"
        >
          View
        </Link>
        {job.applied ? (
          <span className="inline-flex h-8 flex-1 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-500">
            Applied
          </span>
        ) : (
          <Link
            href={`/jobs/${job.id}/apply`}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-[#0a2e2c] text-xs font-extrabold text-white"
          >
            Apply
          </Link>
        )}
      </div>
    </div>
  );
}

export function JobListingCard({ job, cityFallback }: { job: JobCard; cityFallback?: string }) {
  const city = job.city || cityFallback;
  const companyMark = (job.companyName?.[0] || 'C').toUpperCase();

  return (
    <div className="cb-lift-card block p-4">
      <Link href={`/jobs/${job.id}`} className="block">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-teal text-lg font-extrabold text-primary shadow-[0_8px_16px_rgba(10,46,44,0.14)]">
            {companyMark}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-primary">{job.title}</h3>
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
      </Link>
      <div className="mt-3 flex gap-2">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-primary/30 text-xs font-extrabold text-primary"
        >
          View
        </Link>
        {job.applied ? (
          <span className="inline-flex h-8 flex-1 cursor-not-allowed items-center justify-center rounded-full bg-slate-100 text-xs font-extrabold text-slate-500">
            Applied
          </span>
        ) : (
          <Link
            href={`/jobs/${job.id}/apply`}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-full bg-[#0a2e2c] text-xs font-extrabold text-white"
          >
            Apply
          </Link>
        )}
      </div>
    </div>
  );
}
