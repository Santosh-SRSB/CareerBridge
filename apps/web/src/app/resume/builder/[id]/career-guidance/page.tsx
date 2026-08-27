'use client';
// @ts-nocheck

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/features/resume-manual/manual-resume-api';
import SkillChip from '@/features/resume-manual/SkillChip';
import '@/features/resume-manual/manual-editor.css';

function bandClass(band) {
  if (band === 'Excellent Match' || band === 'Strong Match') return 'badge-good';
  return 'badge-warn';
}

export default function CareerGuidancePage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setNotFound(false);
      setResult(null);
      try {
        const data = await api.careerGuidance(id);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Resume not found.';
          setNotFound(/not found/i.test(message));
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const insufficient = Boolean(result?.insufficientContent);

  return (
    <div className="cb-manual-resume-root">
      <div className="app-shell">
        <header className="topbar">
          <Link href="/resume/builder" className="brand">
            <span className="brand-mark">RB</span> Resume Builder
          </Link>
          <nav className="topbar-nav">
            <Link href="/resume/builder">Resumes</Link>
            <Link href="/interviews">Interviews</Link>
            <Link href="/dashboard">CareerBridge home</Link>
          </nav>
        </header>
        <main className="app-main">
          <div className="guidance-page">
            <div className="guidance-header">
              <div>
                <p className="muted small">
                  <Link href={id ? `/resume/builder/${id}` : '/resume/builder'}>← Back to resume</Link>
                </p>
                <h1>Career Guidance</h1>
                {result?.overallReadiness?.headline && !insufficient ? (
                  <p className="guidance-headline">{result.overallReadiness.headline}</p>
                ) : (
                  <p className="muted">See which roles fit the skills already on your resume.</p>
                )}
              </div>
              {id ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => router.push(`/interviews${result?.recommendations?.[0]?.roleTitle ? `?role=${encodeURIComponent(result.recommendations[0].roleTitle)}` : ''}`)}
                >
                  Start Mock Interview
                </button>
              ) : null}
            </div>

            {loading ? <div className="guidance-loading">Matching your resume against 30+ roles…</div> : null}

            {error ? (
              <div className="alert">
                <p>{error}</p>
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => router.push(notFound || !id ? '/resume/builder' : `/resume/builder/${id}`)}
                >
                  {notFound ? 'Back to resumes' : 'Return to editor'}
                </button>
              </div>
            ) : null}

            {!loading && !error && insufficient ? (
              <div className="guidance-card">
                <h2>Add more to your resume first</h2>
                <p>
                  {result.message ||
                    'Add skills, experience, or a project so we can recommend roles that fit your resume.'}
                </p>
                <button className="btn btn-primary" type="button" onClick={() => router.push(`/resume/builder/${id}`)}>
                  Return to editor
                </button>
              </div>
            ) : null}

            {!loading &&
              !error &&
              !insufficient &&
              (result?.recommendations || []).map((role) => (
                <article className="guidance-card" key={role.roleId}>
                  <div className="guidance-card-head">
                    <h2>{role.roleTitle}</h2>
                    <span className={`badge ${bandClass(role.matchBand)}`}>{role.matchBand}</span>
                  </div>
                  {role.matchScore != null ? (
                    <p className="muted small">Fit score {Math.round(role.matchScore)} / 100</p>
                  ) : null}
                  <p>{role.whyThisRole}</p>
                  <h3>Skills you already show</h3>
                  <div className="skill-chip-row">
                    {(role.matchedSkills || []).length ? (
                      role.matchedSkills.map((skill) => (
                        <SkillChip key={skill} tone="good">
                          {skill}
                        </SkillChip>
                      ))
                    ) : (
                      <p className="muted small">No strong skill overlap yet — use the next steps below.</p>
                    )}
                  </div>
                  <h3>Skills to build</h3>
                  {(role.missingSkills || []).length ? (
                    <ul>
                      {role.missingSkills.map((skill) => (
                        <li key={skill}>{skill}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">No major skill gaps jumped out for this role.</p>
                  )}
                  <h3>Suggested next steps</h3>
                  <ul className="guidance-steps">
                    {(role.suggestedNextSteps || []).map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() =>
                      router.push(`/interviews?role=${encodeURIComponent(role.roleTitle)}`)
                    }
                  >
                    Practice interview for this role
                  </button>
                </article>
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
