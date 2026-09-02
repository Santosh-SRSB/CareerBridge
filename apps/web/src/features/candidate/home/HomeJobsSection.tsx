'use client';

import Link from 'next/link';
import type { JobCard } from '@careerbridge/shared';
import { formatJobType, formatSalary } from '@/lib/match';
import { MatchBadge } from '@/components/MatchBadge';

type Props = {
  jobs: JobCard[];
  city?: string;
};

function RecommendedJobCard({ job, cityFallback }: { job: JobCard; cityFallback?: string }) {
  const city = job.city || cityFallback;
  const companyMark = (job.companyName?.[0] || 'C').toUpperCase();

  return (
    <Link href={`/jobs/${job.id}`} className="cb-home-job-card">
      <div className="cb-home-job-card__logo">{companyMark}</div>
      <h3>{job.title}</h3>
      <p className="cb-home-job-card__company">{job.companyName}</p>
      {job.match ? (
        <div className="cb-home-job-card__match">
          <MatchBadge score={job.match.score} />
        </div>
      ) : null}
      <p className="cb-home-job-card__meta">
        {city || 'Location on request'}
        {job.jobType ? ` · ${formatJobType(job.jobType)}` : ''}
      </p>
      <p className="cb-home-job-card__pay">{formatSalary(job.salaryMin, job.salaryMax)}</p>
      <span className="cb-home-job-card__cta">View role</span>
    </Link>
  );
}

export function HomeJobsSection({ jobs, city }: Props) {
  const shown = jobs.slice(0, 5);

  return (
    <section className="cb-home-jobs-hero" aria-labelledby="home-jobs-title">
      <header className="cb-home-jobs-hero__head">
        <div>
          <p className="cb-home-jobs-hero__kicker">Jobs</p>
          <h2 id="home-jobs-title">Recommended for you</h2>
          <p className="cb-home-jobs-hero__lead">
            Roles that fit your Career Passport — open one, or browse the full list.
          </p>
        </div>
      </header>

      <div className="cb-home-jobs-rail">
        {shown.map((job) => (
          <RecommendedJobCard key={job.id} job={job} cityFallback={city} />
        ))}

        {!shown.length ? (
          <div className="cb-home-job-card cb-home-job-card--empty">
            <strong>No matches yet</strong>
            <p>Complete more of your passport to unlock better job recommendations.</p>
            <Link href="/passport?overview=1" className="cb-home-job-card__cta">
              Improve passport
            </Link>
          </div>
        ) : null}

        <Link href="/jobs" className="cb-home-job-card cb-home-job-card--see-all">
          <span className="cb-home-job-card--see-all__icon" aria-hidden="true">
            →
          </span>
          <strong>See all jobs</strong>
          <p>Browse every open role matched to your profile.</p>
        </Link>
      </div>
    </section>
  );
}
