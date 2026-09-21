'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { EmployerCandidatePassport } from '@careerbridge/shared';
import { toAtsMatchBreakdown } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  downloadEmployerCandidateResume,
  getEmployerCandidate,
  notifyMatchedCandidate,
  saveBase64File,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';

function titleCaseName(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function candidateName(row: EmployerCandidatePassport) {
  const raw = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return raw ? titleCaseName(raw) : 'Candidate';
}

function initials(row: EmployerCandidatePassport) {
  const first = row.firstName?.trim()?.[0] || '';
  const last = row.lastName?.trim()?.[0] || '';
  return (first + last || 'C').toUpperCase();
}

function formatLocation(city?: string | null, state?: string | null) {
  const parts = [...(city || '').split(/[,|/·]+/), state || '']
    .map((part) => part.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique.join(', ');
}

function experienceLabel(years: number, months: number) {
  if (years <= 0 && months <= 0) return '0y';
  if (years <= 0) return `${months}m`;
  if (months > 0) return `${years}y ${months}m`;
  return `${years}y`;
}

function educationHeadline(profile: EmployerCandidatePassport) {
  const top = profile.education[0];
  if (!top) return profile.highestEducation || null;
  return [top.qualification, top.institution, top.yearCompleted].filter(Boolean).join(' ');
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
  const [notified, setNotified] = useState(false);

  async function load() {
    const next = await getEmployerCandidate(params.id, jobId);
    setProfile(next);
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load candidate.'))
      .finally(() => setLoading(false));
  }, [params.id, jobId]);

  const ats = useMemo(
    () => (profile?.match ? toAtsMatchBreakdown(profile.match) : null),
    [profile],
  );

  const resolvedJobId = jobId || profile?.application?.jobId;

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
      setMessage(action === 'SHORTLIST' ? 'Candidate has been shortlisted.' : 'Candidate marked as not selected.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy('');
    }
  }

  async function viewResume() {
    if (!profile?.hasResume) return;
    setBusy('RESUME');
    setError('');
    try {
      const file = await downloadEmployerCandidateResume(
        profile.id,
        resolvedJobId || profile.application?.jobId,
      );
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

  async function notify() {
    if (!resolvedJobId || !profile) return;
    setBusy('NOTIFY');
    setError('');
    setMessage('');
    try {
      const result = await notifyMatchedCandidate(profile.id, resolvedJobId);
      setNotified(true);
      setMessage(
        result.whatsappSent
          ? 'WhatsApp message sent to this candidate.'
          : 'Candidate notified in-app. WhatsApp number was not available.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not notify candidate.');
    } finally {
      setBusy('');
    }
  }

  const backHref = fromApps
    ? `/employer/applications${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`
    : '/employer/candidates';

  const locationLine = profile
    ? [formatLocation(profile.city, profile.state), educationHeadline(profile)].filter(Boolean).join(' · ')
    : '';

  return (
    <EmployerShellFallback title="Candidate profile">
      <div className="ep-pass">
        <div className="ep-pass__topbar">
          <Link href={backHref} className="ep-pass__back">
            ← Back to {fromApps ? 'applications' : 'candidates'}
          </Link>
        </div>

        {loading ? <p className="ep-pass__muted">Loading profile…</p> : null}
        {error ? <p className="ep-pass__alert ep-pass__alert--error">{error}</p> : null}
        {message ? <p className="ep-pass__alert ep-pass__alert--ok">{message}</p> : null}

        {profile ? (
          <article className="ep-pass__card">
            <header className="ep-pass__hero">
              <div className="ep-pass__hero-main">
                <span className="ep-pass__avatar" aria-hidden>
                  {initials(profile)}
                </span>
                <div>
                  <h1 className="ep-pass__name">{candidateName(profile)}</h1>
                  {locationLine ? <p className="ep-pass__meta">{locationLine}</p> : null}
                </div>
              </div>
              {ats ? (
                <div className="ep-pass__score">
                  <strong>
                    {ats.score}
                    <em>/100</em>
                  </strong>
                  <span>{ats.bandLabel}</span>
                </div>
              ) : null}
            </header>

            <div className="ep-pass__body">
              <aside className="ep-pass__side">
                <section className="ep-pass__block">
                  <h2>Snapshot</h2>
                  <div className="ep-pass__badges">
                    {profile.openToRelocating ? <span>Open to relocate</span> : null}
                    {profile.hasResume ? <span>Has resume</span> : <span className="is-muted">No resume</span>}
                  </div>
                  <div className="ep-pass__meters">
                    <div>
                      <div className="ep-pass__meter-row">
                        <span>Profile complete</span>
                        <strong>{profile.profileCompletion}%</strong>
                      </div>
                      <div className="ep-pass__meter" aria-hidden>
                        <i style={{ width: `${Math.min(100, Math.max(0, profile.profileCompletion))}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="ep-pass__meter-row">
                        <span>Experience</span>
                        <strong>{experienceLabel(profile.experienceYears, profile.experienceMonths)}</strong>
                      </div>
                      <div className="ep-pass__meter" aria-hidden>
                        <i
                          style={{
                            width: `${Math.min(100, Math.max(8, (profile.experienceYears / 10) * 100 + profile.experienceMonths))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {profile.about ? (
                  <section className="ep-pass__block">
                    <h2>About</h2>
                    <p className="ep-pass__copy">{profile.about}</p>
                  </section>
                ) : null}

                <section className="ep-pass__block">
                  <h2>Education</h2>
                  {profile.education.length === 0 ? (
                    <p className="ep-pass__muted">No education listed yet.</p>
                  ) : (
                    <ul className="ep-pass__edu">
                      {profile.education.map((item) => (
                        <li key={`${item.qualification}-${item.institution}-${item.yearCompleted}`}>
                          <strong>
                            {[item.qualification, item.institution].filter(Boolean).join(' ')}
                          </strong>
                          {item.yearCompleted ? <span>{item.yearCompleted}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="ep-pass__block">
                  <h2>Skills</h2>
                  <div className="ep-pass__chips">
                    {profile.skills.length ? (
                      profile.skills.map((skill) => <span key={skill}>{skill}</span>)
                    ) : (
                      <p className="ep-pass__muted">No skills listed.</p>
                    )}
                  </div>
                </section>
              </aside>

              <div className="ep-pass__main">
                {ats ? (
                  <section className="ep-pass__block">
                    <h2>ATS score breakdown</h2>
                    <ul className="ep-pass__factors">
                      {ats.factors.map((factor) => (
                        <li key={factor.key}>
                          <div className="ep-pass__factor-row">
                            <span>{factor.label}</span>
                            <strong>
                              {factor.score}/{factor.max}
                            </strong>
                          </div>
                          <div className="ep-pass__factor-bar" aria-hidden>
                            <i style={{ width: `${Math.min(100, Math.max(0, factor.pct))}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : (
                  <section className="ep-pass__block">
                    <h2>ATS score breakdown</h2>
                    <p className="ep-pass__muted">Select a job match to see ATS scoring for this profile.</p>
                  </section>
                )}

                {ats && (ats.reasons.length > 0 || ats.gaps.length > 0) ? (
                  <section className="ep-pass__block">
                    <div className="ep-pass__split">
                      <div>
                        <h3>Why this matches</h3>
                        {ats.reasons.length ? (
                          <ul className="ep-pass__reasons">
                            {ats.reasons.map((reason) => (
                              <li key={reason}>
                                <span aria-hidden>✓</span>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ep-pass__muted">No strengths listed.</p>
                        )}
                      </div>
                      <div>
                        <h3>Missing / weaker</h3>
                        {ats.gaps.length ? (
                          <ul className="ep-pass__gaps">
                            {ats.gaps.map((gap) => (
                              <li key={gap}>
                                <span aria-hidden>!</span>
                                {gap}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ep-pass__muted">No major gaps flagged.</p>
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="ep-pass__block">
                  <h2>Experience</h2>
                  {profile.experiences.length === 0 ? (
                    <p className="ep-pass__muted">No experience listed yet.</p>
                  ) : (
                    <ul className="ep-pass__exp">
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
              </div>
            </div>

            <footer className="ep-pass__foot">
              <div className="ep-pass__foot-left">
                {profile.application ? (
                  <span className="ep-pass__pill">
                    Applied · {profile.application.jobTitle}
                  </span>
                ) : resolvedJobId ? (
                  <span className="ep-pass__pill">Matched profile</span>
                ) : null}
              </div>
              <div className="ep-pass__foot-actions">
                {profile.hasResume ? (
                  <button
                    type="button"
                    className="ep-pass__btn ep-pass__btn--ghost"
                    disabled={busy !== ''}
                    onClick={() => void viewResume()}
                  >
                    {busy === 'RESUME' ? 'Opening…' : 'Download resume'}
                  </button>
                ) : null}
                {profile.application &&
                profile.application.status !== 'SHORTLISTED' &&
                profile.application.status !== 'HIRED' ? (
                  <Button
                    type="button"
                    size="sm"
                    block={false}
                    className="ep-pass__btn ep-pass__btn--solid"
                    loading={busy === 'SHORTLIST'}
                    loadingLabel="…"
                    disabled={busy !== ''}
                    onClick={() => void act('SHORTLIST')}
                  >
                    Shortlist
                  </Button>
                ) : null}
                {resolvedJobId ? (
                  <button
                    type="button"
                    className="ep-pass__btn ep-pass__btn--wa"
                    disabled={busy !== '' || notified}
                    onClick={() => void notify()}
                  >
                    {busy === 'NOTIFY' ? '…' : notified ? 'WhatsApp sent' : 'Notify via WhatsApp'}
                  </button>
                ) : null}
                {profile.application ? (
                  <Link
                    href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(profile.application.id)}&jobId=${encodeURIComponent(profile.application.jobId)}`}
                    className="ep-pass__btn ep-pass__btn--ghost"
                  >
                    Schedule interview
                  </Link>
                ) : null}
              </div>
            </footer>
          </article>
        ) : null}
      </div>
    </EmployerShellFallback>
  );
}
