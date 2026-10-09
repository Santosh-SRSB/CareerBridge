'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { listAllEmployerApplications, listEmployerJobs } from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import {
  EvApplicationPill,
  EvAvatar,
  EvEmpty,
  EvMatch,
  EvMiniStage,
  EvPageHead,
  EvSkeleton,
  EvStat,
} from '@/components/employer/ui';
import { ErrorState } from '@/components/ui/StateViews';
import { LOAD_ERROR_MESSAGE } from '@/lib/client-errors';
import { SortableHeader } from '@/components/ui/SortableHeader';
import { nextSort, sortRows, type SortState, type SortValue } from '@/lib/table-sort';

type ApplicationSortKey = 'candidate' | 'experience' | 'location' | 'score' | 'status' | 'newest';

const APPLICATION_SORT_VALUE: Record<ApplicationSortKey, (app: EmployerApplication) => SortValue> = {
  candidate: (app) => candidateName(app),
  experience: (app) => experienceYears(app),
  location: (app) => app.candidate.city || null,
  score: (app) => app.match?.score ?? null,
  status: (app) => applicationStatusLabel(app.status),
  newest: (app) => +new Date(app.createdAt),
};

function applicationStatusLabel(status: string) {
  if (status === 'SHORTLISTED') return 'Shortlisted';
  if (status === 'INTERVIEW') return 'Interview';
  if (status === 'APPLIED') return 'Applied';
  if (status === 'UNDER_REVIEW' || status === 'REVIEW') return 'Under Review';
  if (status === 'ON_HOLD') return 'On Hold';
  if (status === 'SELECTED') return 'Selected';
  if (status === 'HIRED') return 'Hired';
  if (status === 'REJECTED') return 'Rejected';
  if (status === 'WITHDRAWN') return 'Withdrawn';
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
  const [sort, setSort] = useState<SortState<ApplicationSortKey>>({ key: 'score', dir: 'desc' });
  const onSort = (key: ApplicationSortKey) =>
    setSort((current) => nextSort(current, key, key === 'score' || key === 'experience' ? 'desc' : 'asc'));
  const [jobs, setJobs] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError('');
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
      .catch(() => setError(LOAD_ERROR_MESSAGE))
      .finally(() => setLoading(false));
  }, [jobFromQuery, reloadKey]);

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
    return sortRows(rows, APPLICATION_SORT_VALUE[sort.key], sort.dir);
  }, [
    jobScoped,
    statusFilter,
    experienceFilter,
    locationFilter,
    skillFilter,
    scoreFilter,
    sort,
  ]);

  const selectedJobTitle =
    jobFilter === 'all' ? null : jobs.find((job) => job.id === jobFilter)?.title || filtered[0]?.job.title || null;

  const counts = useMemo(() => {
    const by = (statuses: string[]) => jobScoped.filter((item) => statuses.includes(item.status)).length;
    return {
      total: jobScoped.length,
      applied: by(['APPLIED', 'UNDER_REVIEW', 'REVIEW']),
      shortlisted: by(['SHORTLISTED']),
      interview: by(['INTERVIEW']),
    };
  }, [jobScoped]);

  return (
    <EmployerShellFallback title="Applications">
      <>
        <EvPageHead
          eyebrow="Pipeline"
          title={selectedJobTitle ? `Applications — ${selectedJobTitle}` : 'Applications'}
          subtitle="Review inbound candidates by Profile Match and status. Click View to open the full candidate profile."
        />

        <div className="ev-grid ev-g4 ev-mt">
          <EvStat label="Total" value={loading ? '—' : counts.total} hint="All applications" icon="▦" />
          <EvStat label="Applied" value={loading ? '—' : counts.applied} hint="Awaiting review" icon="✉" />
          <EvStat label="Shortlisted" value={loading ? '—' : counts.shortlisted} hint="In pipeline" icon="★" />
          <EvStat label="Interview" value={loading ? '—' : counts.interview} hint="In interview stage" icon="◷" />
        </div>

        <div className="ev-card ev-mt ev-filterbar" role="group" aria-label="Filters">
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
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="SHORTLISTED">Shortlisted</option>
              <option value="INTERVIEW">Interview</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="SELECTED">Selected</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Profile Match</span>
            <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
              <option value="all">Profile Match</option>
              <option value="90">90+ Excellent</option>
              <option value="80">80+ Strong</option>
              <option value="70">70+ Good</option>
              <option value="60">60+ Potential</option>
              <option value="below60">Below 60</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort</span>
            <select
              value={sort.key === 'score' || sort.key === 'newest' ? sort.key : 'custom'}
              onChange={(e) => {
                if (e.target.value === 'score' || e.target.value === 'newest') {
                  setSort({ key: e.target.value, dir: 'desc' });
                }
              }}
            >
              <option value="score">Sort: Profile Match</option>
              <option value="newest">Sort: Newest</option>
              {sort.key !== 'score' && sort.key !== 'newest' ? (
                <option value="custom" disabled>
                  Sort: column header
                </option>
              ) : null}
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

        {error && !loading ? (
          <div className="ev-mt">
            <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
          </div>
        ) : null}
        {loading ? (
          <div className="ev-mt" aria-busy="true">
            <span className="sr-only">Loading applications…</span>
            <EvSkeleton height={280} />
          </div>
        ) : null}

        {!loading && !error && items.length > 0 && filtered.length === 0 ? (
          <div className="ev-card ev-mt" role="status">
            <EvEmpty title="No applications match these filters." body="Try another job, status or Profile Match filter." />
          </div>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <div className="ev-card ev-mt">
            <EvEmpty
              title="No applications yet"
              body="Publish a job to start receiving candidates."
              action={
                <Link href="/employer/jobs/new" className="ev-btn ev-btn--accent">
                  + Post a job
                </Link>
              }
            />
          </div>
        ) : null}

        {!loading && filtered.length > 0 ? (
          <>
            <div className="ev-card ev-mt">
              <div className="ev-scroll">
                <table className="ev-table ev-table--sort">
                  <thead>
                    <tr>
                      <SortableHeader sortKey="candidate" sort={sort} onSort={onSort}>
                        Candidate
                      </SortableHeader>
                      <SortableHeader sortKey="experience" sort={sort} onSort={onSort}>
                        Experience
                      </SortableHeader>
                      <SortableHeader sortKey="location" sort={sort} onSort={onSort}>
                        Location
                      </SortableHeader>
                      <SortableHeader sortKey="score" sort={sort} onSort={onSort}>
                        Profile Match
                      </SortableHeader>
                      <SortableHeader sortKey="status" sort={sort} onSort={onSort}>
                        Stage
                      </SortableHeader>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => {
                      const profileHref = `/employer/candidates/${item.candidate.id}?jobId=${encodeURIComponent(item.job.id)}&from=applications`;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div className="ev-who">
                              <EvAvatar name={candidateName(item)} size="md" />
                              <div>
                                <b>{candidateName(item)}</b>
                                {jobFilter === 'all' ? <span className="ev-sub">{item.job.title}</span> : null}
                                {item.employerNote ? (
                                  <small className="ev-note-line" title="Private note — not visible to the candidate">
                                    Note: {item.employerNote}
                                  </small>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>{experienceLabel(experienceYears(item))}</td>
                          <td>{item.candidate.city || '—'}</td>
                          <td>
                            <EvMatch score={item.match?.score} />
                          </td>
                          <td>
                            <span style={{ whiteSpace: 'nowrap' }}>
                              <EvApplicationPill status={item.status} />
                              <EvMiniStage status={item.status} />
                            </span>
                          </td>
                          <td>
                            <Link href={profileHref} className="ev-btn ev-btn--ghost ev-btn--sm">
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="ev-note">
              Click <b>View</b> to open the candidate profile with the Profile Match breakdown.
            </p>
          </>
        ) : null}
      </>
    </EmployerShellFallback>
  );
}
