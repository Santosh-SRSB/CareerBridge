'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import ManualResumeEditor from '@/features/resume-manual/ManualResumeEditor';
import '@/features/resume-manual/manual-editor.css';

export default function ResumeBuilderEditorPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  if (!id) {
    return (
      <div className="cb-manual-resume-root">
        <p className="muted" style={{ padding: 24 }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="cb-manual-resume-root">
      <div className="app-shell">
        <header className="topbar no-print">
          <Link href="/resume/builder" className="brand">
            <span className="brand-mark">RB</span> Resume Builder
          </Link>
          <nav className="topbar-nav">
            <Link href="/resume/builder">Resumes</Link>
            <Link href="/interviews">Interviews</Link>
            <Link href={`/resume/builder/${id}/career-guidance`}>Career Guidance</Link>
            <Link href="/dashboard">CareerBridge home</Link>
          </nav>
        </header>
        <main className="app-main">
          <ManualResumeEditor resumeId={id} />
        </main>
      </div>
    </div>
  );
}
