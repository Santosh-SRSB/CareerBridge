'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lora } from 'next/font/google';
import { useParams, useRouter } from 'next/navigation';
import type { JobDetail } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { getStoredUser } from '@/lib/session';
import { formatJobType, formatSalary, matchLabel } from '@/lib/match';
import { fetchJobDetails, submitApplication } from '@/lib/candidate-marketplace-api';
import { saveJob, unsaveJob } from '@/lib/api';

const lora = Lora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-lora-job',
  display: 'swap',
});

const RING_C = 2 * Math.PI * 30;

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [matchPct, setMatchPct] = useState(0);
  const [ringOffset, setRingOffset] = useState(RING_C);

  useEffect(() => {
    fetchJobDetails(params.id)
      .then(setJob)
      .catch(() => setError('This job is no longer available.'));
  }, [params.id]);

  useEffect(() => {
    if (!job?.match) return;
    const target = Math.max(0, Math.min(100, job.match.score)) / 100;
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min((now - start) / 900, 1);
      const eased = 1 - (1 - t) ** 3;
      setMatchPct(Math.round(target * 100 * eased));
      setRingOffset(RING_C - target * eased * RING_C);
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    const delay = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, 400);

    return () => {
      window.clearTimeout(delay);
      cancelAnimationFrame(raf);
    };
  }, [job?.match]);

  async function toggleSave() {
    if (!job || !getStoredUser()) {
      router.push('/login');
      return;
    }
    setSaving(true);
    try {
      if (job.saved) {
        await unsaveJob(job.id);
        setJob({ ...job, saved: false });
      } else {
        await saveJob(job.id);
        setJob({ ...job, saved: true });
      }
    } catch {
      // keep current state
    } finally {
      setSaving(false);
    }
  }

  async function onApply() {
    if (!job) return;
    if (!getStoredUser()) {
      router.push(`/login?role=candidate&next=${encodeURIComponent(`/jobs/${job.id}`)}`);
      return;
    }
    setApplying(true);
    setError('');
    try {
      const application = await submitApplication(job.id);
      setJob({ ...job, applied: true });
      router.replace(`/applications/${application.id}/confirmation`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'We could not send your application right now.';
      if (/already applied/i.test(message)) {
        setJob({ ...job, applied: true });
      }
      setError(message);
      setApplying(false);
    }
  }

  if (error && !job) {
    return (
      <CandidateAppShell activeTab="jobs">
        <p className="text-red-600">{error}</p>
      </CandidateAppShell>
    );
  }

  if (!job) {
    return (
      <CandidateAppShell activeTab="jobs">
        <p className="text-slate-500">Loading job details...</p>
      </CandidateAppShell>
    );
  }

  const matched = job.match?.reasons || [];
  const gaps = job.match?.gaps || [];
  const recommendations = job.match?.recommendations?.length
    ? job.match.recommendations
    : gaps.slice(0, 3).map((gap) => `Add ${gap} to your profile and resume`);
  const breakdown = job.match
    ? [
        { label: 'Skills', value: job.match.skillScore },
        { label: 'Experience', value: job.match.experienceScore },
        { label: 'Education', value: job.match.educationScore ?? 0 },
        { label: 'Location', value: job.match.locationScore },
        { label: 'Resume Quality', value: job.match.resumeQualityScore ?? 0 },
      ]
    : [];
  const eyebrow = [formatJobType(job.jobType), job.city].filter(Boolean).join(' · ').toUpperCase();

  return (
    <CandidateAppShell activeTab="jobs" maxWidth="max-w-[1440px]">
      <div className={`cb-job-detail ${lora.variable}`}>
        <Link href="/jobs" className="cb-job-detail__back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Find Jobs
        </Link>

        <div className="cb-job-detail__layout">
            <div className="cb-job-detail__hero cb-job-detail__fx">
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleSave()}
                className="cb-job-detail__bookmark"
                aria-label={job.saved ? 'Unsave job' : 'Save job'}
                title={job.saved ? 'Saved' : 'Save job'}
              >
                {job.saved ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" className="fill-[#0c2822]" aria-hidden>
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                ) : (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0c2822"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                )}
              </button>

              {eyebrow ? <p className="cb-job-detail__eyebrow">{eyebrow}</p> : null}
              <h1>{job.title}</h1>
              <p className="cb-job-detail__company">{job.companyName}</p>
              <p className="cb-job-detail__salary">
                {formatSalary(job.salaryMin, job.salaryMax)}
                <span> /month</span>
              </p>
              {job.experience ? (
                <p className="cb-job-detail__salary-meta">Experience: {job.experience}</p>
              ) : null}

              <div className="cb-job-detail__tags">
                {job.jobType ? <span>{formatJobType(job.jobType)}</span> : null}
                {job.city ? <span>{job.city}</span> : null}
                {job.category ? <span>{job.category}</span> : null}
              </div>
            </div>

            <div className="cb-job-detail__panel cb-job-detail__about cb-job-detail__fx" style={{ animationDelay: '0.08s' }}>
              <h3>About the job</h3>
              <p className="cb-job-detail__body">{job.description}</p>
            </div>

            <div className="cb-job-detail__panel cb-job-detail__reqs cb-job-detail__fx" style={{ animationDelay: '0.16s' }}>
              <h3>Requirements</h3>
              <div className="cb-job-detail__req-grid">
                {job.requiredSkills.map((skill, index) => (
                  <div
                    key={skill}
                    className="cb-job-detail__req-chip"
                    style={{ animationDelay: `${0.05 + index * 0.05}s` }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {skill}
                  </div>
                ))}
              </div>
            </div>

            <aside className="cb-job-detail__aside">
              {job.match ? (
                <div
                  className="cb-job-detail__side-card cb-job-detail__match cb-job-detail__fx"
                  style={{ animationDelay: '0.12s' }}
                >
                  <div className="cb-job-detail__ats-head">
                    <h4>Your Match</h4>
                    <p className="cb-job-detail__ats-sub">Based on your profile, resume &amp; this job</p>
                  </div>

                  <div className="cb-job-detail__ats-score">
                    <div className="cb-job-detail__ring" aria-hidden>
                      <svg width="78" height="78" viewBox="0 0 70 70">
                        <circle cx="35" cy="35" r="30" fill="none" stroke="#e7e9e0" strokeWidth="8" />
                        <circle
                          cx="35"
                          cy="35"
                          r="30"
                          fill="none"
                          stroke="#f5821f"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={RING_C}
                          strokeDashoffset={ringOffset}
                          style={{
                            transform: 'rotate(-90deg)',
                            transformOrigin: '50% 50%',
                            transition: 'stroke-dashoffset 1.1s cubic-bezier(.22,.61,.36,1)',
                          }}
                        />
                      </svg>
                      <div className="cb-job-detail__ring-txt">{matchPct}</div>
                    </div>
                    <div>
                      <p className="cb-job-detail__ats-score-num">
                        {matchPct} <span>/ 100</span>
                      </p>
                      <p className="cb-job-detail__ats-label">{matchLabel(job.match.score)}</p>
                    </div>
                  </div>

                  <div className="cb-job-detail__ats-breakdown">
                    {breakdown.map((row) => (
                      <div key={row.label} className="cb-job-detail__ats-row">
                        <span>{row.label}</span>
                        <div className="cb-job-detail__ats-bar-wrap">
                          <div
                            className="cb-job-detail__ats-bar"
                            style={{ width: `${Math.max(0, Math.min(100, row.value))}%` }}
                          />
                        </div>
                        <strong>{Math.round(row.value)}%</strong>
                      </div>
                    ))}
                  </div>

                  {recommendations.length ? (
                    <div className="cb-job-detail__ats-improve">
                      <p className="cb-job-detail__ats-improve-title">Improve your match</p>
                      <ul>
                        {recommendations.map((tip) => (
                          <li key={tip}>
                            <span aria-hidden>→</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {matched.length ? (
                    <p className="cb-job-detail__ats-strengths">
                      Strengths: {matched.join(' · ')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div
                  className="cb-job-detail__side-card cb-job-detail__match cb-job-detail__fx"
                  style={{ animationDelay: '0.12s' }}
                >
                  <h4 className="m-0 text-[14px] font-extrabold text-[#16211d]">Your Match</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#4a534d]">
                    Sign in with a complete profile to see your ATS match for this role — score
                    breakdown and tips to improve.
                  </p>
                  <Link href="/login?role=candidate" className="cb-job-detail__ats-link mt-4 inline-flex">
                    Sign in to see match
                  </Link>
                </div>
              )}
            </aside>

            {error ? (
              <p className="cb-job-detail__error mb-4 text-sm font-semibold text-red-600">{error}</p>
            ) : null}

            <div className="cb-job-detail__apply cb-job-detail__fx" style={{ animationDelay: '0.22s' }}>
              <p>
                {job.applied
                  ? 'You have already applied for this role.'
                  : <>Ready to apply for <b>{job.title}</b>?</>}
              </p>
              {job.applied ? (
                <Link href="/applications" className="cb-job-detail__btn-apply is-applied">
                  Applied
                </Link>
              ) : (
                <button
                  type="button"
                  className="cb-job-detail__btn-apply"
                  disabled={applying}
                  onClick={() => void onApply()}
                >
                  {applying ? 'Applying…' : 'Apply Now'}
                </button>
              )}
            </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
