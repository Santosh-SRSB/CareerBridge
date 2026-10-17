'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/features/resume-manual/manual-resume-api';
import '@/features/resume-manual/manual-editor.css';

/** Top-nav entry: if one resume exists, open its guidance; else go to resume list. */
export default function CareerGuidanceEntryPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listResumes();
        if (cancelled) return;
        const resumes = Array.isArray(list) ? list : [];
        if (resumes.length === 1) {
          router.replace(`/resume/builder/${resumes[0].id}/career-guidance`);
          return;
        }
        router.replace('/resume/builder');
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your resumes.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="cb-manual-resume-root">
        <div className="guidance-page">
          <div className="alert">
            <p>{error}</p>
            <button className="btn btn-primary" type="button" onClick={() => router.push('/resume/builder')}>
              Back to resumes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cb-manual-resume-root">
      <div className="guidance-page">
        <p className="muted">Finding a resume for Career Guidance…</p>
      </div>
    </div>
  );
}
