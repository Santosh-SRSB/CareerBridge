'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/features/resume-manual/manual-resume-api';
import '@/features/resume-manual/manual-editor.css';

const BLANK_DATA = {
  fullName: '',
  title: '',
  email: '',
  phone: '',
  location: '',
  linkedin: '',
  website: '',
  summary: '',
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  careerGaps: [],
  photo: null,
  targetRole: '',
  jobDescription: '',
};

export default function FriendResumeDashboard() {
  const router = useRouter();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listResumes();
      setResumes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load resumes.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const resume = await api.createResume({
        title: 'Untitled resume',
        templateId: 'ats-minimal',
        data: BLANK_DATA,
      });
      router.push(`/resume/builder/${resume.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create resume.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this resume? This can't be undone.")) return;
    try {
      await api.deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete resume.');
    }
  }

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
            <Link href="/resume/builder/career-guidance">Career Guidance</Link>
            <Link href="/dashboard">CareerBridge home</Link>
          </nav>
        </header>
        <main className="app-main">
          <div className="dashboard">
            <div className="dashboard-header">
              <div>
                <h1>Your resumes</h1>
                <p className="muted">Create a resume once, then preview it in any template.</p>
              </div>
              <div className="ready-prompt-actions">
                <button className="btn" type="button" onClick={() => router.push('/interviews')}>
                  Mock interviews
                </button>
                <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating…' : '+ New resume'}
                </button>
              </div>
            </div>

            {error ? <div className="alert">{error}</div> : null}

            {loading ? (
              <p className="muted">Loading…</p>
            ) : resumes.length === 0 ? (
              <div className="empty-state">
                <p>You don&apos;t have any resumes yet.</p>
                <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                  Create your first resume
                </button>
              </div>
            ) : (
              <div className="resume-grid">
                {resumes.map((r) => (
                  <div
                    key={r.id}
                    className="resume-card"
                    onClick={() => router.push(`/resume/builder/${r.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/resume/builder/${r.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="resume-card-thumb">
                      {r.data?.fullName ? String(r.data.fullName)[0] : '?'}
                    </div>
                    <div className="resume-card-body">
                      <h3>{r.title}</h3>
                      <p className="muted">{r.data?.fullName || 'No name yet'}</p>
                      <span className="badge">{r.templateId}</span>
                    </div>
                    <div className="resume-card-actions">
                      <button
                        className="btn btn-small"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/resume/builder/${r.id}/career-guidance`);
                        }}
                      >
                        Career Guidance
                      </button>
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(r.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
