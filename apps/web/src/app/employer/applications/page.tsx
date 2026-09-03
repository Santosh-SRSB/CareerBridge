'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { listAllEmployerApplications, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';

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
  if (score >= 85) return 'high';
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
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedId, setSelectedId] = useState('');
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
    return jobScoped.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      const years = experienceYears(item);
      if (experienceFilter === 'fresher' && years > 0) return false;
      if (experienceFilter === '1' && years !== 1) return false;
      if (experienceFilter === '2plus' && years < 2) return false;
      if (locationFilter !== 'all' && item.candidate.city !== locationFilter) return false;
      if (skillFilter !== 'all' && !item.candidate.skills.includes(skillFilter)) return false;
      return true;
    });
  }, [jobScoped, statusFilter, experienceFilter, locationFilter, skillFilter]);

  const selectedJobTitle =
    jobFilter === 'all' ? null : jobs.find((job) => job.id === jobFilter)?.title || filtered[0]?.job.title || null;
  const selected = filtered.find((item) => item.id === selectedId) || filtered[0] || null;

  return (
    <EmployerShellFallback title="Applications">
      <div className="ep-apps">
        <p className="ep-dash__eyebrow">Home · Applications</p>
        <header className="ep-dash__hello">
          <div>
            <h1 className="ep-dash__title">
              Applications
              {selectedJobTitle ? (
                <>
                  {' '}
                  — <span>{selectedJobTitle}</span>
                </>
              ) : null}
            </h1>
            <p className="ep-dash__sub">Review inbound candidates, match scores, and status.</p>
          </div>
        </header>

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

        <article className="ep-apps__card">
          {loading ? <p className="ep-apps__empty">Loading applications…</p> : null}

          {!loading && filtered.length === 0 ? (
            <div className="ep-dash__empty-card">
              <div className="ep-dash__empty-ico" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2h9l5 5v15H6z" />
                  <path d="M14 2v5h5" />
                </svg>
              </div>
              <p className="ep-dash__empty-title">No applications yet</p>
              <p className="ep-dash__empty">Publish a job to start receiving candidates.</p>
            </div>
          ) : null}

          {!loading && filtered.length > 0 ? (
            <>
              <div className="ep-apps__table-wrap">
                <table className="ep-apps__table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Experience</th>
                      <th>Match</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const active = (selected?.id || '') === item.id;
                      const score = item.match?.score;
                      return (
                        <tr
                          key={item.id}
                          className={active ? 'is-active' : ''}
                          onClick={() => setSelectedId(item.id)}
                        >
                          <td>
                            <strong>{candidateName(item)}</strong>
                            {jobFilter === 'all' ? <em>{item.job.title}</em> : null}
                          </td>
                          <td>{experienceLabel(experienceYears(item))}</td>
                          <td>
                            {score != null ? (
                              <span className={`ep-apps__match ep-apps__match--${matchTone(score)}`}>
                                {score}%
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="ep-apps__foot">
                {selected ? (
                  <Link
                    href={`/employer/candidates/${selected.candidate.id}?jobId=${encodeURIComponent(selected.job.id)}`}
                    className="ep-apps__view"
                  >
                    View Candidate
                  </Link>
                ) : (
                  <span className="ep-apps__view is-disabled">View Candidate</span>
                )}
              </div>
            </>
          ) : null}
        </article>
      </div>
    </EmployerShellFallback>
  );
}
