'use client';

import { userFacingError } from '@/lib/client-errors';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import type { EmployerCandidatePassport } from '@careerbridge/shared';
import { PROFILE_MATCH_LABEL } from '@careerbridge/shared';
import {
  changeApplicationStatus,
  downloadEmployerCandidateResume,
  getEmployerCandidate,
  saveBase64File,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { toast } from '@/components/ui/Toast';
import { ShortlistConfirmModal } from '@/components/employer/ShortlistConfirmModal';
import { RejectConfirmModal } from '@/components/employer/RejectConfirmModal';
import { EmployerAtsPanel } from '@/components/employer/EmployerAtsPanel';
import { EvAlert, EvApplicationPill, EvPageHead, EvSkeleton } from '@/components/employer/ui';
import { pipelineStage } from '@/lib/employer-ui-status';

const FINAL_APPLICATION_STATUSES = ['HIRED', 'REJECTED', 'WITHDRAWN'];
const SCHEDULABLE_APPLICATION_STATUSES = ['SHORTLISTED', 'INTERVIEW', 'ON_HOLD'];
const PIPELINE_LABELS = ['Applied', 'Shortlisted', 'Interview', 'Hired'];

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
  const [modal, setModal] = useState<'SHORTLIST' | 'REJECT' | null>(null);
  const [modalError, setModalError] = useState('');

  async function load() {
    const next = await getEmployerCandidate(params.id, jobId);
    setProfile(next);
  }

  useEffect(() => {
    void load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load candidate.'))
      .finally(() => setLoading(false));
  }, [params.id, jobId]);

  const resolvedJobId = jobId || profile?.application?.jobId;

  async function act(action: 'SHORTLIST' | 'REJECT', text: string) {
    if (!profile?.application) return;
    setBusy(action);
    setModalError('');
    setMessage('');
    try {
      await changeApplicationStatus(
        profile.application.id,
        action,
        action === 'REJECT' ? text || undefined : undefined,
        action === 'SHORTLIST' ? text || undefined : undefined,
      );
      toast.success(action === 'SHORTLIST' ? 'Candidate shortlisted' : 'Candidate rejected');
      setModal(null);
      await load().catch(() => undefined);
    } catch (err) {
      const text = userFacingError(err, action === 'SHORTLIST' ? 'shortlist candidate' : 'reject candidate');
      setModalError(text);
      toast.error(text);
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

  const backHref = fromApps
    ? `/employer/applications${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ''}`
    : '/employer/candidates';

  const locationLine = profile ? formatLocation(profile.city, profile.state) : '';

  const application = profile?.application ?? null;
  const stage = pipelineStage(application?.status);

  return (
    <EmployerShellFallback title="Candidate profile">
      <EvPageHead
        eyebrow="Candidate profile"
        title={
          profile ? (
            <span className="ev-title-av">
              <span className="ev-av" aria-hidden>
                {initials(profile)}
              </span>
              {candidateName(profile)}
            </span>
          ) : (
            'Candidate'
          )
        }
        subtitle={
          profile
            ? [application ? `Applied · ${application.jobTitle}` : resolvedJobId ? 'Matched profile' : null, locationLine]
                .filter(Boolean)
                .join(' · ') || undefined
            : undefined
        }
        actions={
          <Link href={backHref} className="ev-btn ev-btn--ghost">
            ← Back to {fromApps ? 'applications' : 'candidates'}
          </Link>
        }
      />

      <div className="ev-mt">
        {error ? <EvAlert tone="error">{error}</EvAlert> : null}
        {message ? <EvAlert tone="ok">{message}</EvAlert> : null}
      </div>

      {loading ? (
        <div className="ev-grid ev-g2-wide" aria-busy="true">
          <span className="sr-only">Loading profile…</span>
          <EvSkeleton height={320} />
          <EvSkeleton height={320} />
        </div>
      ) : null}

      {profile ? (
        <>
          <div className="ev-grid ev-g2-wide">
            <section className="ev-card">
              <h2 className="ev-h2">{PROFILE_MATCH_LABEL}</h2>
              {profile.match ? (
                <EmployerAtsPanel match={profile.match} />
              ) : (
                <p className="ev-sub">Select a job to see the Profile Match breakdown for this profile.</p>
              )}
            </section>

            <section className="ev-card">
              <h2 className="ev-h2">Application status</h2>
              {application ? (
                stage < 0 ? (
                  <p>
                    <EvApplicationPill status={application.status} />
                  </p>
                ) : (
                  <div className="ev-stepper" aria-label={`Current stage: ${application.status}`}>
                    {PIPELINE_LABELS.map((label, index) => (
                      <span key={label} className={index <= stage ? 'done' : undefined}>
                        {label}
                      </span>
                    ))}
                  </div>
                )
              ) : (
                <p className="ev-sub">
                  {resolvedJobId
                    ? 'Matched profile — this candidate has not applied to this job yet.'
                    : 'This candidate has not applied to one of your jobs.'}
                </p>
              )}

              <div className="ev-kvl">
                {application ? (
                  <div>
                    <small>APPLIED FOR</small>
                    <b>{application.jobTitle}</b>
                  </div>
                ) : null}
                {application ? (
                  <div>
                    <small>CURRENT STATUS</small>
                    <b>
                      <EvApplicationPill status={application.status} />
                    </b>
                  </div>
                ) : null}
                <div>
                  <small>EXPERIENCE</small>
                  <b>{experienceLabel(profile.experienceYears, profile.experienceMonths)}</b>
                </div>
                {profile.highestEducation ? (
                  <div>
                    <small>HIGHEST EDUCATION</small>
                    <b>{profile.highestEducation}</b>
                  </div>
                ) : null}
                <div>
                  <small>CANDIDATE LOCATION</small>
                  <b>{formatLocation(profile.city, profile.state) || 'Not provided'}</b>
                </div>
                <div>
                  <small>PROFILE COMPLETE</small>
                  <b>{profile.profileCompletion}%</b>
                </div>
                <div>
                  <small>RESUME</small>
                  <b>{profile.hasResume ? 'Available' : 'No resume'}</b>
                </div>
                {profile.openToRelocating ? (
                  <div>
                    <small>RELOCATION</small>
                    <b>Open to relocate</b>
                  </div>
                ) : null}
              </div>

              <div className="ev-actions">
                {application && ['APPLIED', 'UNDER_REVIEW', 'ON_HOLD'].includes(application.status) ? (
                  <button
                    type="button"
                    className="ev-btn"
                    disabled={busy !== ''}
                    onClick={() => {
                      setModalError('');
                      setModal('SHORTLIST');
                    }}
                  >
                    Shortlist
                  </button>
                ) : null}
                {application?.status === 'SHORTLISTED' ? (
                  <span className="ev-btn ev-btn--ghost ev-btn--static" aria-label="Already shortlisted">
                    Shortlisted ✓
                  </span>
                ) : null}
                {application && SCHEDULABLE_APPLICATION_STATUSES.includes(application.status) ? (
                  <Link
                    href={`/employer/interviews/schedule?applicationId=${encodeURIComponent(application.id)}&jobId=${encodeURIComponent(application.jobId)}`}
                    className="ev-btn ev-btn--ghost"
                  >
                    Schedule interview
                  </Link>
                ) : null}
                {profile.hasResume ? (
                  <button
                    type="button"
                    className="ev-btn ev-btn--ghost"
                    disabled={busy !== ''}
                    onClick={() => void viewResume()}
                  >
                    {busy === 'RESUME' ? 'Opening…' : 'Download resume'}
                  </button>
                ) : null}
                {application && !FINAL_APPLICATION_STATUSES.includes(application.status) ? (
                  <button
                    type="button"
                    className="ev-btn ev-btn--danger"
                    disabled={busy !== ''}
                    onClick={() => {
                      setModalError('');
                      setModal('REJECT');
                    }}
                  >
                    Reject
                  </button>
                ) : null}
              </div>
            </section>
          </div>

          <div className="ev-grid ev-g2 ev-mt">
            <section className="ev-card">
              {profile.about ? (
                <>
                  <h2 className="ev-h2">About</h2>
                  <p className="ev-copy">{profile.about}</p>
                </>
              ) : null}
              <h2 className="ev-h2">Skills</h2>
              {profile.skills.length ? (
                <div className="ev-chips">
                  {profile.skills.map((skill) => (
                    <span key={skill} className="ev-chip">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="ev-sub">No skills listed.</p>
              )}
            </section>

            <section className="ev-card">
              <h2 className="ev-h2">Experience</h2>
              {profile.experiences.length === 0 ? (
                <p className="ev-sub">No experience listed yet.</p>
              ) : (
                <ul className="ev-tl">
                  {profile.experiences.map((item) => (
                    <li key={`${item.company}-${item.jobTitle}`}>
                      <b>{item.jobTitle}</b>
                      <span className="ev-sub">
                        {item.company}
                        {item.isInternship ? ' · Internship' : ''}
                        {item.stillInCompany ? ' · Current' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="ev-h2">Education</h2>
              {profile.education.length === 0 ? (
                <p className="ev-sub">No education listed yet.</p>
              ) : (
                <ul className="ev-tl">
                  {profile.education.map((item) => (
                    <li key={`${item.qualification}-${item.institution}-${item.yearCompleted}`}>
                      <b>{[item.qualification, item.institution].filter(Boolean).join(' ')}</b>
                      {item.yearCompleted ? <span className="ev-sub">{item.yearCompleted}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
      <ShortlistConfirmModal
        open={modal === 'SHORTLIST'}
        candidateName={profile ? candidateName(profile) : 'Candidate'}
        jobTitle={profile?.application?.jobTitle}
        busy={busy === 'SHORTLIST'}
        error={modalError}
        onCancel={() => setModal(null)}
        onConfirm={(note) => act('SHORTLIST', note)}
      />
      <RejectConfirmModal
        open={modal === 'REJECT'}
        candidateName={profile ? candidateName(profile) : 'Candidate'}
        jobTitle={profile?.application?.jobTitle}
        busy={busy === 'REJECT'}
        error={modalError}
        onCancel={() => setModal(null)}
        onConfirm={(reason) => act('REJECT', reason)}
      />
    </EmployerShellFallback>
  );
}
