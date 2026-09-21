'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { atsMatchBandLabel } from '@careerbridge/shared';
import { listAllEmployerApplications, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerSectionHero } from '@/components/employer/EmployerSectionHero';
import { EmployerEmptyCue } from '@/components/employer/EmployerEmptyCue';

function applicationStatusLabel(status: string) {
  if (status === 'SHORTLISTED') return 'Shortlisted';
  if (status === 'INTERVIEW') return 'Interview';
  if (status === 'APPLIED') return 'Applied';
  if (status === 'UNDER_REVIEW' || status === 'REVIEW') return 'In review';
  if (status === 'SELECTED') return 'Selected';
  if (status === 'HIRED') return 'Hired';
  if (status === 'REJECTED') return 'Not selected';
  return status.replaceAll('_', ' ');
}

function candidateName(app: EmployerApplication) {
  return [app.candidate.firstName, app.candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
}

function experienceYears(app: EmployerApplication) {
  return app.candidate.experienceYears ?? 0;
}

function experienceLabel(years: number) {
  if (years <= 0) return 'Fresher';
  if (years === 1) return '1 Year';
  return `${years} Years`;
}

function matchTone(score: number) {
  if (score >= 90) return 'high';
  if (score >= 70) return 'mid';
  return 'low';
}

export default function EmployerApplicationsIndex() {
  return (
    <Suspense>
      <EmployerApplicationsBody />
    </Suspense>
  );
}

function EmployerApplicationsBody() {
  const searchParams = useSearchParams();
  const jobFromQuery = searchParams.get('jobId') || '';
  const [items, setItems] = useState<EmployerApplication[]>([]);
  const [jobFilter, setJobFilter] = useState(jobFromQuery || 'all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [scoreFilter, setScoreFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'score' | 'newest'>('score');
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([listAllEmployerApplications(), listEmployerJobs().catch(() => [])])
      .then(([apps, jobRows]) => {
        setItems(apps);
        setJobs(jobRows.map((job) => ({ id: job.id, title: job.title })));
        if (jobFromQuery) {
          setJobFilter(jobFromQuery);
        } else if (jobRows.length === 1) {
          setJobFilter(jobRows[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load applications.'))
      .finally(() => setLoading(false));
  }, [jobFromQuery]);

  const jobScoped = useMemo(() => {
    if (jobFilter === 'all') return items;
    return items.filter((item) => item.job.id === jobFilter);
  }, [items, jobFilter]);

  const locations = useMemo(() => {
    return [...new Set(jobScoped.map((item) => item.candidate.city).filter(Boolean) as string[])].sort();
  }, [jobScoped]);

  const skills = useMemo(() => {
    return [...new Set(jobScoped.flatMap((item) => item.candidate.skills))].sort();
  }, [jobScoped]);

  const filtered = useMemo(() => {
    const rows = jobScoped.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      const years = experienceYears(item);
      if (experienceFilter === 'fresher' && years > 0) return false;
      if (experienceFilter === '1' && years !== 1) return false;
      if (experienceFilter === '2plus' && years < 2) return false;
      if (locationFilter !== 'all' && item.candidate.city !== locationFilter) return false;
      if (skillFilter !== 'all' && !item.candidate.skills.includes(skillFilter)) return false;
      const score = item.match?.score ?? -1;
      if (scoreFilter === '90' && score < 90) return false;
      if (scoreFilter === '80' && score < 80) return false;
      if (scoreFilter === '70' && score < 70) return false;
      if (scoreFilter === '60' && score < 60) return false;
      if (scoreFilter === 'below60' && (score < 0 || score >= 60)) return false;
      return true;
    });
    return rows.sort((a, b) => {
      if (sortBy === 'newest') {
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      }
      return (b.match?.score ?? -1) - (a.match?.score ?? -1);
    });
  }, [
    jobScoped,
    statusFilter,
    experienceFilter,
    locationFilter,
    skillFilter,
    scoreFilter,
    sortBy,
  ]);

  const selectedJobTitle =
    jobFilter === 'all' ? null : jobs.find((job) => job.id === jobFilter)?.title || filtered[0]?.job.title || null;

  return (
    <EmployerShellFallback title="Applications">
      <div className="ep-apps ep-page ep-page--applications">
        <EmployerSectionHero
          tone="applications"
          title={selectedJobTitle ? `Applications — ${selectedJobTitle}` : 'Applications'}
          subtitle="Review inbound candidates by ATS score and status. Click View to open the full candidate profile."
        />

        <div className="ep-apps__filters" role="group" aria-label="Filters">
          <span className="ep-apps__filters-label">Filters:</span>
          <label>
            <span className="sr-only">Job</span>
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
              <option value="all">All jobs</option>
              {jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="APPLIED">Applied</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="INTERVIEW">Interview</option>
              <option value="SELECTED">Selected</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Not selected</option>
            </select>
          </label>
          <label>
            <span className="sr-only">ATS score</span>
            <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
              <option value="all">ATS score</option>
              <option value="90">90+ Excellent</option>
              <option value="80">80+ Strong</option>
              <option value="70">70+ Good</option>
              <option value="60">60+ Potential</option>
              <option value="below60">Below 60</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'score' | 'newest')}>
              <option value="score">Sort: ATS score</option>
              <option value="newest">Sort: Newest</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Experience</span>
            <select value={experienceFilter} onChange={(e) => setExperienceFilter(e.target.value)}>
              <option value="all">Experience</option>
              <option value="fresher">Fresher</option>
              <option value="1">1 Year</option>
              <option value="2plus">2+ Years</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Location</span>
            <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="all">Location</option>
              {locations.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Skills</span>
            <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
              <option value="all">Skills</option>
              {skills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <p className="ep-apps__error">{error}</p> : null}
        {loading ? <p className="ep-apps__empty">Loading applications…</p> : null}

        {!loading && filtered.length === 0 ? (
          <div className="ep-polished-empty">
            <EmployerEmptyCue cue="search" />
            <div>
              <p className="ep-polished-empty__title">No applications yet</p>
              <p className="ep-polished-empty__copy">Publish a job to start receiving candidates.</p>
              <Link href="/employer/jobs/new" className="ep-hero__link ep-polished-empty__cta">
                + Post a job
              </Link>
            </div>
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="ep-apps__sheet">
            <div className="ep-apps__table-wrap">
              <table className="ep-apps__sheet-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Experience</th>
                    <th>Location</th>
                    <th>ATS score</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const score = item.match?.score;
                    const profileHref = `/employer/candidates/${item.candidate.id}?jobId=${encodeURIComponent(item.job.id)}&from=applications`;
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{candidateName(item)}</strong>
                          {jobFilter === 'all' ? <em>{item.job.title}</em> : null}
                        </td>
                        <td>{experienceLabel(experienceYears(item))}</td>
                        <td>{item.candidate.city || '—'}</td>
                        <td>
                          {score != null ? (
                            <span
                              className={`ep-apps__match ep-apps__match--${matchTone(score)}`}
                              title={atsMatchBandLabel(score)}
                            >
                              {score}
                              <em>{atsMatchBandLabel(score).replace(' Match', '')}</em>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <span className={`ep-apps__status ep-apps__status--${item.status.toLowerCase()}`}>
                            {applicationStatusLabel(item.status)}
                          </span>
                        </td>
                        <td>
                          <Link href={profileHref} className="ep-apps__row-view">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="ep-apps__hint">
              Click <strong>View</strong> to open the candidate profile on a separate page.
            </p>
          </div>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
