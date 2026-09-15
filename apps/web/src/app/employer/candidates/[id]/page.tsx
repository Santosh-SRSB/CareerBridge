'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { EmployerCandidatePassport } from '@careerbridge/shared';
import { atsMatchBandLabel } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  downloadEmployerCandidateResume,
  getEmployerCandidate,
  saveBase64File,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { EmployerAtsPanel } from '@/components/employer/EmployerAtsPanel';
import { Button } from '@/components/ui/Button';

function candidateName(row: EmployerCandidatePassport) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Candidate';
}

function initials(row: EmployerCandidatePassport) {
  const first = row.firstName?.trim()?.[0] || '';
  const last = row.lastName?.trim()?.[0] || '';
  return (first + last || 'C').toUpperCase();
}

function statusLabel(status: string) {
  if (status === 'SHORTLISTED') return 'Shortlisted';
  if (status === 'INTERVIEW') return 'Interview';
  if (status === 'APPLIED') return 'Applied';
  if (status === 'SELECTED') return 'Selected';
  if (status === 'HIRED') return 'Hired';
  if (status === 'REJECTED') return 'Not selected';
  return status.replaceAll('_', ' ');
}

export default function EmployerCandidateProfilePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || undefined;
  const fromApps = searchParams.get('from') === 'applications';
  const [profile, setProfile] = useState<EmployerCandidatePassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const next = await getEmployerCandidate(params.id, jobId);
    setProfile(next);
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load candidate.'))
      .finally(() => setLoading(false));
  }, [params.id, jobId]);

  async function act(action: 'SHORTLIST' | 'REJECT') {
    if (!profile?.application) return;
    if (action === 'REJECT' && !window.confirm('Reject this candidate for this role?')) {
      return;
    }
    setBusy(action);
    setError('');
    setMessage('');
    try {
      await changeApplicationStatus(profile.application.id, action);
      setMessage(action === 'SHORTLIST' ? 'Candidate shortlisted.' : 'Candidate marked as not selected.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy('');
    }
  }

  async function viewResume() {
    if (!profile?.application || !profile.hasResume) return;
    setBusy('RESUME');
    setError('');
    try {
      const file = await downloadEmployerCandidateResume(profile.id, profile.application.jobId);
      if (file.pdf) {
        saveBase64File(file.pdf, file.fileName || 'resume.pdf', file.mimeType || 'application/pdf');
        return;
      }
      if (file.html) {
        saveBase64File(file.html, file.fileName || 'resume.html', file.mimeType || 'text/html');
        return;
      }
      setError('Resume file was empty.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open resume.');
    } finally {
      setBusy('');
    }
  }

  const backHref = fromApps
    ? `/employer/applications${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`
    : '/employer/candidates';

  return (
    <EmployerShellFallback title="Candidate profile">
      <div className="ep-cprof">
        <div className="ep-cprof__topbar">
          <Link href={backHref} className="ep-cprof__back">
            ← Back to {fromApps ? 'applications' : 'candidates'}
          </Link>
        </div>

        {loading ? <p className="ep-cprof__muted">Loading profile…</p> : null}
        {error ? <p className="ep-cprof__error">{error}</p> : null}
        {message ? <p className="ep-cprof__ok">{message}</p> : null}

        {profile ? (
          <>
            <header className="ep-cprof__hero">
              <div className="ep-cprof__hero-main">
                <span className="ep-cprof__avatar" aria-hidden>
                  {initials(profile)}
                </span>
                <div>
                  <p className="ep-cprof__eyebrow">Candidate profile</p>
                  <h1 className="ep-cprof__name">{candidateName(profile)}</h1>
                  <p className="ep-cprof__meta">
                    {[
                      profile.city,
                      profile.state,
                      profile.highestEducation,
                      profile.application ? statusLabel(profile.application.status) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {profile.application ? (
                    <p className="ep-cprof__role">Applied for {profile.application.jobTitle}</p>
                  ) : null}
                </div>
              </div>
              <div className="ep-cprof__hero-stats">
                {profile.match ? (
                  <div className="ep-cprof__score-pill">
                    <strong>{profile.match.score}</strong>
                    <span>/100 · {atsMatchBandLabel(profile.match.score)}</span>
                  </div>
                ) : null}
                <div className="ep-cprof__mini">
                  <span>Profile</span>
                  <strong>{profile.profileCompletion}%</strong>
                </div>
                <div className="ep-cprof__mini">
                  <span>Experience</span>
                  <strong>
                    {profile.experienceYears}y
                    {profile.experienceMonths ? ` ${profile.experienceMonths}m` : ''}
                  </strong>
                </div>
              </div>
            </header>

            <div className="ep-cprof__grid">
              <div className="ep-cprof__main">
                {profile.match ? (
                  <section className="ep-cprof__card ep-cprof__card--ats">
                    <EmployerAtsPanel match={profile.match} className="ep-cprof__ats" />
                  </section>
                ) : null}

                {profile.about ? (
                  <section className="ep-cprof__card">
                    <h2>About</h2>
                    <p className="ep-cprof__copy">{profile.about}</p>
                  </section>
                ) : null}

                <section className="ep-cprof__card">
                  <h2>Skills</h2>
                  <div className="ep-cprof__chips">
                    {profile.skills.length ? (
                      profile.skills.map((skill) => <span key={skill}>{skill}</span>)
                    ) : (
                      <p className="ep-cprof__muted">No skills listed.</p>
                    )}
                  </div>
                </section>

                <section className="ep-cprof__card">
                  <h2>Experience</h2>
                  {profile.experiences.length === 0 ? (
                    <p className="ep-cprof__muted">No experience listed yet.</p>
                  ) : (
                    <ul className="ep-cprof__list">
                      {profile.experiences.map((item) => (
                        <li key={`${item.company}-${item.jobTitle}`}>
                          <strong>{item.jobTitle}</strong>
                          <span>
                            {item.company}
                            {item.isInternship ? ' · Internship' : ''}
                            {item.stillInCompany ? ' · Current' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="ep-cprof__card">
                  <h2>Education</h2>
                  {profile.education.length === 0 ? (
                    <p className="ep-cprof__muted">No education listed yet.</p>
                  ) : (
                    <ul className="ep-cprof__list">
                      {profile.education.map((item) => (
                        <li key={`${item.qualification}-${item.institution}`}>
                          <strong>{item.qualification}</strong>
                          <span>
                            {[item.institution, item.yearCompleted].filter(Boolean).join(' · ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <aside className="ep-cprof__aside">
                <section className="ep-cprof__card ep-cprof__card--action">
                  <h2>Actions</h2>
                  {profile.application ? (
                    <div className="ep-cprof__actions">
                      <Button
                        type="button"
                        size="sm"
                        block
                        loading={busy === 'SHORTLIST'}
                        loadingLabel="…"
                        disabled={profile.application.status === 'SHORTLISTED' || busy !== ''}
                        onClick={() => void act('SHORTLIST')}
                        className="ep-cprof__btn-primary"
                      >
                        Shortlist
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        block
                        loading={busy === 'REJECT'}
                        loadingLabel="…"
                        disabled={profile.application.status === 'REJECTED' || busy !== ''}
                        onClick={() => void act('REJECT')}
                      >
                        Not selected
                      </Button>
                      <Link
                        href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(profile.application.id)}&jobId=${encodeURIComponent(profile.application.jobId)}`}
                        className="ep-cprof__btn-link"
                      >
                        Schedule interview
                      </Link>
                      {profile.hasResume ? (
                        <button
                          type="button"
                          className="ep-cprof__btn-text"
                          disabled={busy !== ''}
                          onClick={() => void viewResume()}
                        >
                          {busy === 'RESUME' ? 'Opening resume…' : 'View resume'}
                        </button>
                      ) : (
                        <p className="ep-cprof__muted">Resume not uploaded yet.</p>
                      )}
                      <Link href={`/employer/jobs/${profile.application.jobId}`} className="ep-cprof__btn-text">
                        View job posting →
                      </Link>
                    </div>
                  ) : (
                    <p className="ep-cprof__muted">
                      This candidate has not applied to your roles yet. Shortlist becomes available after they apply.
                    </p>
                  )}
                </section>

                <section className="ep-cprof__card">
                  <h2>Summary</h2>
                  <dl className="ep-cprof__dl">
                    <div>
                      <dt>Open to relocate</dt>
                      <dd>{profile.openToRelocating ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt>Has resume</dt>
                      <dd>{profile.hasResume ? 'Yes' : 'No'}</dd>
                    </div>
                  </dl>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
