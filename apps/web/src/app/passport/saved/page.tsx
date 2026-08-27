'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CandidateProfile } from '@careerbridge/shared';
import { CandidateResumeSheet } from '@/components/CandidateResumeSheet';
import { Button } from '@/components/ui/Button';
import { createResume, getCandidateMe } from '@/lib/api';
import { clearPendingResumeBuild, profileToResumeContent } from '@/lib/resume-build';
import { markPassportFlowDone } from '@/lib/passport-flow';
import { getStoredUser, patchStoredUser } from '@/lib/session';

function profileToHtml(profile: CandidateProfile) {
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Candidate';
  const content = profileToResumeContent(profile);
  const edu = content.education
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.qualification)}</strong>${item.institution ? ` · ${escapeHtml(item.institution)}` : ''}</li>`,
    )
    .join('');
  const skills = content.skills.map((item) => `<span>${escapeHtml(item)}</span>`).join(' ');
  const exp = content.experiences
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.jobTitle || '')}</strong>${item.company ? ` · ${escapeHtml(item.company)}` : ''}</li>`,
    )
    .join('');
  const gap =
    profile.gapMonths || profile.gapReason
      ? `<section><h2>Career gap</h2><p>${profile.gapMonths ? `${profile.gapMonths} months` : ''}${
          profile.gapReason ? ` — ${escapeHtml(profile.gapReason)}` : ''
        }</p></section>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(name)} — CareerBridge Resume</title>
  <style>
    body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;color:#0a2e2c;line-height:1.5}
    h1{margin:0 0 4px;font-size:28px} h2{margin:24px 0 8px;font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#0d9488}
    .meta{color:#567} .skills span{display:inline-block;margin:0 8px 8px 0;padding:4px 10px;border-radius:999px;background:#e8f7f4;font-size:13px}
    ul{padding-left:18px} li{margin:6px 0}
  </style>
</head>
<body>
  <h1>${escapeHtml(name)}</h1>
  <p class="meta">${escapeHtml([content.city, content.phone].filter(Boolean).join(' · '))}</p>
  ${gap}
  <section><h2>Education</h2><ul>${edu || '<li>Not added</li>'}</ul></section>
  <section><h2>Skills</h2><div class="skills">${skills || 'Not added'}</div></section>
  <section><h2>Experience</h2><ul>${exp || '<li>Not added</li>'}</ul></section>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default function PassportSavedPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [saving, setSaving] = useState(true);
  const [savedPath, setSavedPath] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        clearPendingResumeBuild();
        const next = await getCandidateMe();
        if (cancelled) return;
        setProfile(next);

        // Mark onboarding done so dashboard never returns to with/without resume choice.
        patchStoredUser({ onboardingCompleted: true, firstName: next.firstName });
        markPassportFlowDone(stored.id);

        // Persist a lightweight resume record (no PDF download).
        await createResume({
          targetJobTitle: next.careerInterests[0] || undefined,
          template: 'CLASSIC',
          includePhoto: Boolean(next.photoUrl),
        }).catch(() => null);

        const html = profileToHtml(next);
        const response = await fetch('/api/v1/candidates/resume/snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: stored.id,
            html,
            fileName: `${[next.firstName, next.lastName].filter(Boolean).join('-') || 'resume'}.html`,
          }),
        });
        const body = (await response.json()) as { success?: boolean; data?: { path: string }; error?: { message: string } };
        if (!response.ok || !body.success) {
          throw new Error(body.error?.message || 'Could not save resume file.');
        }
        if (!cancelled) setSavedPath(body.data?.path || '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not save your resume right now.');
        }
      } finally {
        if (!cancelled) setSaving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!profile) {
    return <main className="cb-app text-muted">Saving your resume...</main>;
  }

  return (
    <main className="cb-profile-page">
      <div className="cb-resume-flow-wrap">
        <p className="cb-resume-kicker">All set</p>
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl">
          {saving ? 'Saving your resume…' : 'Your resume is saved'}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          We saved what you entered so far. You can improve it later with Build ATS Resume or Enhance Resume —
          download is available there, not on this step.
        </p>
        {savedPath ? (
          <p className="mt-2 text-sm font-semibold text-teal">Saved to {savedPath}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-error">{error}</p> : null}

        <div className="mt-6">
          <CandidateResumeSheet profile={profile} title="Saved resume" />
        </div>

        <div className="mt-6">
          <Button
            type="button"
            size="md"
            block={false}
            disabled={saving}
            onClick={() => router.replace('/dashboard')}
          >
            Go to candidate dashboard
          </Button>
        </div>
      </div>
    </main>
  );
}
