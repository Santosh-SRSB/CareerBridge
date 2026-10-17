'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
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
          <div className="flex items-center gap-2.5">
            <BrandLogo href="/resume/builder" label="Resume Builder" size="sm" priority />
            <span className="border-l border-slate-300 pl-2.5 text-sm font-semibold text-slate-600">Resume Builder</span>
          </div>
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
