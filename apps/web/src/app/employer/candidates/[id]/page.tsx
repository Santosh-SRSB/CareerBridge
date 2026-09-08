'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { EmployerCandidatePassport } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  downloadEmployerCandidateResume,
  getEmployerCandidate,
  saveBase64File,
} from '@/lib/api';
import { EmployerShellFallback, EmployerPageHeader } from '@/components/EmployerPortal';
import { StatusBadge } from '@/components/AppNav';
import { Button } from '@/components/ui/Button';

function candidateName(row: EmployerCandidatePassport) {
  return [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Candidate';
}

export default function EmployerCandidateProfilePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') || undefined;
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

  return (
    <EmployerShellFallback title="Candidate profile">
      <div className="ep-desk">
        <EmployerPageHeader
          title="Candidate Profile"
          subtitle="Recruitment-ready view — contact stays private until they apply."
          action={
            <Link href="/employer/candidates" className="ep-link">
              ← Back to search
            </Link>
          }
        />

        {loading ? <p className="text-sm text-muted">Loading profile…</p> : null}
        {error ? <p className="text-sm font-semibold text-error">{error}</p> : null}
        {message ? <p className="mb-3 text-sm font-semibold text-teal">{message}</p> : null}

        {profile ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <article className="ep-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-extrabold text-primary">{candidateName(profile)}</h1>
                  <p className="mt-1 text-sm text-muted">
                    {[profile.city, profile.state, profile.highestEducation].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {profile.application ? <StatusBadge status={profile.application.status} /> : null}
              </div>

              {profile.match ? (
                <section className="mt-6">
                  <h2 className="text-sm font-extrabold text-primary">Job Match</h2>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fog">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, profile.match.score))}%` }}
                      />
                    </div>
                    <strong className="text-lg text-emerald-700">{profile.match.score}%</strong>
                  </div>
                </section>
              ) : null}

              {profile.about ? (
                <section className="mt-6">
                  <h2 className="text-sm font-extrabold text-primary">About</h2>
                  <p className="mt-2 text-sm leading-relaxed text-primary/90">{profile.about}</p>
                </section>
              ) : null}

              <section className="mt-6">
                <h2 className="text-sm font-extrabold text-primary">Skills</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-fog px-2.5 py-0.5 text-xs font-bold text-primary">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <h2 className="text-sm font-extrabold text-primary">Experience</h2>
                {profile.experiences.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No experience listed yet.</p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {profile.experiences.map((item) => (
                      <li key={`${item.company}-${item.jobTitle}`} className="rounded-xl bg-fog/60 px-4 py-3">
                        <p className="font-extrabold text-primary">{item.jobTitle}</p>
                        <p className="text-sm text-muted">
                          {item.company}
                          {item.isInternship ? ' · Internship' : ''}
                          {item.stillInCompany ? ' · Current' : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mt-6">
                <h2 className="text-sm font-extrabold text-primary">Education</h2>
                <ul className="mt-2 space-y-2">
                  {profile.education.map((item) => (
                    <li key={`${item.qualification}-${item.institution}`} className="text-sm text-primary/90">
                      <span className="font-bold">{item.qualification}</span>
                      {item.institution ? ` — ${item.institution}` : ''}
                      {item.yearCompleted ? ` (${item.yearCompleted})` : ''}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="mt-6">
                <h2 className="text-sm font-extrabold text-primary">Resume</h2>
                {profile.application && profile.hasResume ? (
                  <div className="mt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={busy === 'RESUME'}
                      loadingLabel="Opening…"
                      disabled={busy !== ''}
                      onClick={() => void viewResume()}
                    >
                      View resume
                    </Button>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    {profile.application
                      ? 'Not uploaded yet.'
                      : 'Resume is available after the candidate applies to one of your jobs.'}
                  </p>
                )}
              </section>
            </article>

            <aside className="space-y-4">
              <article className="ep-card">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Summary</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Profile</dt>
                    <dd className="font-bold text-primary">{profile.profileCompletion}%</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Experience</dt>
                    <dd className="font-bold text-primary">
                      {profile.experienceYears}y {profile.experienceMonths ? `${profile.experienceMonths}m` : ''}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Relocate</dt>
                    <dd className="font-bold text-primary">{profile.openToRelocating ? 'Yes' : 'No'}</dd>
                  </div>
                </dl>
              </article>

              {profile.application ? (
                <article className="ep-card space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Application</p>
                  <p className="font-extrabold text-primary">{profile.application.jobTitle}</p>
                  <div className="flex flex-col gap-2">
                    <Button
                      type="button"
                      size="sm"
                      block
                      loading={busy === 'SHORTLIST'}
                      loadingLabel="…"
                      disabled={profile.application.status === 'SHORTLISTED' || busy !== ''}
                      onClick={() => void act('SHORTLIST')}
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
                      Reject
                    </Button>
                    <Link
                      href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(profile.application.id)}&jobId=${encodeURIComponent(profile.application.jobId)}`}
                      className="ep-btn-gold inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-extrabold"
                    >
                      Schedule interview
                    </Link>
                    {profile.hasResume ? (
                      <button
                        type="button"
                        className="ep-link text-left text-sm font-extrabold"
                        disabled={busy !== ''}
                        onClick={() => void viewResume()}
                      >
                        {busy === 'RESUME' ? 'Opening resume…' : 'View resume →'}
                      </button>
                    ) : null}
                    <Link href={`/employer/jobs/${profile.application.jobId}`} className="ep-link text-sm font-extrabold">
                      View on job →
                    </Link>
                  </div>
                </article>
              ) : (
                <article className="ep-card">
                  <p className="text-sm text-muted">
                    This candidate has not applied to your roles yet. Shortlist becomes available after they apply for a job.
                  </p>
                </article>
              )}
            </aside>
          </div>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
