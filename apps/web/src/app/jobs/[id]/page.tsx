'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Lora } from 'next/font/google';
import { useParams, useRouter } from 'next/navigation';
import type { JobDetail } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { getStoredUser } from '@/lib/session';
import { formatJobType, formatSalary } from '@/lib/match';
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
      router.replace(`/applications/${application.id}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your application right now.');
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
                  <div className="cb-job-detail__match-top">
                    <div className="cb-job-detail__ring">
                      <svg width="70" height="70" viewBox="0 0 70 70" aria-hidden>
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
                      <div className="cb-job-detail__ring-txt">{matchPct}%</div>
                    </div>
                    <div>
                      <h4>Your match</h4>
                      <span>Based on your current profile</span>
                    </div>
                  </div>

                  {matched.length ? (
                    <>
                      <p className="cb-job-detail__gap-label" style={{ color: '#2f6b4f' }}>
                        STRENGTHS
                      </p>
                      <ul className="cb-job-detail__gap-list">
                        {matched.map((reason, index) => (
                          <li key={reason} style={{ animationDelay: `${0.5 + index * 0.08}s` }}>
                            <span className="cb-job-detail__check">✓</span>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {gaps.length ? (
                    <>
                      <p className="cb-job-detail__gap-label">GAPS TO CLOSE</p>
                      <ul className="cb-job-detail__gap-list">
                        {gaps.map((gap, index) => (
                          <li
                            key={gap}
                            style={{ animationDelay: `${0.55 + matched.length * 0.08 + index * 0.08}s` }}
                          >
                            <span className="cb-job-detail__tri">△</span>
                            {gap}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : (
                <div
                  className="cb-job-detail__side-card cb-job-detail__match cb-job-detail__fx"
                  style={{ animationDelay: '0.12s' }}
                >
                  <h4 className="m-0 text-[14px] font-extrabold text-[#16211d]">Your match</h4>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#4a534d]">
                    Sign in with a complete profile to see how well you match this role.
                  </p>
                </div>
              )}
            </aside>

            {error ? (
              <p className="cb-job-detail__error mb-4 text-sm font-semibold text-red-600">{error}</p>
            ) : null}

            <div className="cb-job-detail__apply cb-job-detail__fx" style={{ animationDelay: '0.22s' }}>
              <p>
                Ready to apply for <b>{job.title}</b>?
              </p>
              {job.applied ? (
                <Link href="/applications" className="cb-job-detail__btn-apply">
                  Track Application
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
