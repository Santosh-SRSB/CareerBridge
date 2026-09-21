'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lora } from 'next/font/google';
import { useRouter } from 'next/navigation';
import type { CandidateProfile, ResumeRecord } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { getTemplateComponent } from '@/components/resume-templates/index.js';
import { buildResumeFromResumeContent } from '@/features/resume/build-resume-from-resume-content';
import { masterResumeToAtsData } from '@/features/resume/master-to-ats-data';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { getCandidateMe, getResume, listResumes } from '@/lib/api';
import { formatCandidateExperienceLine, resolveTotalExperienceYears } from '@/lib/format-candidate-experience';
import { rememberReturnTo } from '@/lib/nav-return';
import { getStoredUser } from '@/lib/session';
import '@/components/resume-templates/resume-template-01.css';

const lora = Lora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-lora-details',
  display: 'swap',
});

function pretty(value?: string | null) {
  if (!value?.trim()) return '';
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function fullName(profile: CandidateProfile) {
  return (
    [profile.firstName, profile.lastName]
      .filter(Boolean)
      .map((part) => pretty(part))
      .join(' ')
      .trim() || 'Candidate'
  );
}

function relativeUpdated(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Updated today';
  if (days === 1) return 'Updated 1 day ago';
  if (days < 30) return `Updated ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? 'Updated 1 month ago' : `Updated ${months} months ago`;
}

function SectionHead({
  title,
  onEdit,
}: {
  title: string;
  onEdit: () => void;
}) {
  return (
    <div className="cb-cand-details__sec-head">
      <h3>{title}</h3>
      <button type="button" className="cb-cand-details__edit" onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

export default function ProfileDetailsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewDoc, setPreviewDoc] = useState<MasterResumeDocument | null>(null);

  const Template = useMemo(() => getTemplateComponent('resume-template-01'), []);
  const templateData = useMemo(
    () => (previewDoc ? masterResumeToAtsData(previewDoc) : null),
    [previewDoc],
  );

  const refresh = useCallback(async () => {
    const [nextProfile, nextResumes] = await Promise.all([getCandidateMe(), listResumes()]);
    setProfile(nextProfile);
    setResumes(nextResumes);
  }, []);

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    refresh()
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load profile.'))
      .finally(() => setLoading(false));
  }, [refresh, router]);

  function closeToDashboard() {
    router.push('/dashboard');
  }

  function goEdit(path: string) {
    rememberReturnTo('/profile/details');
    router.push(path);
  }

  async function openResumePreview(id: string) {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewDoc(null);
    try {
      const [record, me] = await Promise.all([
        getResume(id),
        getCandidateMe().catch(() => null),
      ]);
      const doc = buildResumeFromResumeContent(
        {
          ...record.content,
          fullName: record.content.fullName || '',
          summary: record.content.summary || record.summary || '',
        },
        record.summary,
        {
          linkedin: me?.links?.linkedin,
          github: me?.links?.github,
          portfolio: me?.links?.portfolio || me?.links?.website,
        },
      );
      setPreviewDoc(doc);
      setPreviewTitle(record.title || 'Resume');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Could not open resume.');
    } finally {
      setPreviewLoading(false);
    }
  }

  function closeResumePreview() {
    setPreviewOpen(false);
    setPreviewDoc(null);
    setPreviewError('');
    setPreviewTitle('');
  }

  if (loading || !profile) {
    return (
      <CandidateAppShell activeTab="home" showBack title="Candidate Details" onBack={closeToDashboard}>
        <p className="py-12 text-center text-sm text-slate-500">
          {error || 'Loading your details…'}
        </p>
      </CandidateAppShell>
    );
  }

  const name = fullName(profile);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'C';
  const experienceYears = resolveTotalExperienceYears(profile);
  const experienceLine = formatCandidateExperienceLine(profile) || 'Fresher';
  const roleHint =
    profile.experiences.find((e) => e.stillInCompany)?.jobTitle ||
    profile.experiences[0]?.jobTitle ||
    profile.careerInterests[0] ||
    'Candidate';
  const location = [pretty(profile.city), pretty(profile.state)].filter(Boolean).join(', ') || '—';
  const headline = `${pretty(roleHint)} · ${pretty(profile.city) || 'India'}`;
  const yearsLabel =
    experienceYears >= 1
      ? `${Math.floor(experienceYears)}+ year${Math.floor(experienceYears) === 1 ? '' : 's'} of experience`
      : experienceLine.includes('Internship')
        ? 'Internship'
        : experienceLine.includes('Fresher')
          ? 'Fresher'
          : null;
  const tags = [
    yearsLabel || (experienceLine.includes('Fresher') ? 'Fresher' : experienceLine),
    profile.openToRelocating ? 'Open to relocate' : null,
  ].filter(Boolean) as string[];

  return (
    <CandidateAppShell
      activeTab="home"
      showBack
      title="Candidate Details"
      onBack={closeToDashboard}
      maxWidth="max-w-[880px]"
    >
      <div className={`cb-cand-details ${lora.variable}`}>
        <button type="button" className="cb-cand-details__back" onClick={closeToDashboard}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Home
        </button>

        {error ? <p className="mb-3 text-sm font-semibold text-red-600">{error}</p> : null}

        <div className="cb-cand-details__box cb-cand-details__fx">
          <div className="cb-cand-details__title">
            <h1>Candidate Details</h1>
            <button
              type="button"
              className="cb-cand-details__cut"
              aria-label="Close"
              onClick={closeToDashboard}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="cb-cand-details__profile">
            <div className="cb-cand-details__photo">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photoUrl} alt="" />
              ) : (
                initials
              )}
            </div>
            <div className="cb-cand-details__info">
              <div className="cb-cand-details__info-top">
                <div>
                  <h2>{name}</h2>
                  <p>{headline}</p>
                </div>
                <button
                  type="button"
                  className="cb-cand-details__edit"
                  onClick={() => goEdit('/passport/photo')}
                >
                  Edit
                </button>
              </div>
              {tags.length ? (
                <div className="cb-cand-details__tags">
                  {tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="cb-cand-details__summary">
            <div className="cb-cand-details__sec-head">
              <p className="cb-cand-details__sec-label" style={{ margin: 0 }}>
                SUMMARY
              </p>
              <button
                type="button"
                className="cb-cand-details__edit"
                onClick={() => goEdit('/passport/personal')}
              >
                Edit
              </button>
            </div>
            <p>
              {profile.about?.trim() ||
                'Add a short summary on your profile so recruiters understand your background.'}
            </p>
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Personal Details" onEdit={() => goEdit('/passport/personal')} />
            <div className="cb-cand-details__kv">
              <div className="kv">
                <span className="k">EMAIL</span>
                <span className="v">{profile.email || '—'}</span>
              </div>
              <div className="kv">
                <span className="k">PHONE</span>
                <span className="v">{profile.phone || '—'}</span>
              </div>
              <div className="kv">
                <span className="k">LOCATION</span>
                <span className="v">{location}</span>
              </div>
              <div className="kv">
                <span className="k">EXPERIENCE</span>
                <span className="v">{experienceLine}</span>
              </div>
            </div>
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Skills" onEdit={() => goEdit('/passport/skills')} />
            {profile.skills.length ? (
              <div className="cb-cand-details__skills">
                {profile.skills.map((skill) => (
                  <span key={skill.id}>{skill.name}</span>
                ))}
              </div>
            ) : (
              <p className="cb-cand-details__empty">No skills added yet.</p>
            )}
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Experience" onEdit={() => goEdit('/passport/experience')} />
            {experienceYears >= 1 ? (
              <p className="cb-cand-details__exp-years">
                <strong>
                  {Math.floor(experienceYears)}+ year
                  {Math.floor(experienceYears) === 1 ? '' : 's'}
                </strong>{' '}
                of experience
              </p>
            ) : yearsLabel ? (
              <p className="cb-cand-details__exp-years">{yearsLabel}</p>
            ) : null}
            {profile.experiences.length ? (
              profile.experiences.map((exp, index) => (
                <div key={exp.id} className="cb-cand-details__timeline">
                  <div className="dot-col">
                    <div className="dot" />
                    {index < profile.experiences.length - 1 ? <div className="line" /> : null}
                  </div>
                  <div className="content">
                    <b>
                      {exp.jobTitle || 'Role'}
                      {exp.isInternship ? ' · Intern' : ''}
                    </b>
                    <div className="org">{exp.company || '—'}</div>
                    <div className="dates">
                      {[exp.startDate, exp.stillInCompany ? 'Present' : exp.endDate]
                        .filter(Boolean)
                        .join(' — ') || 'Dates not set'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="cb-cand-details__empty">No experience added yet.</p>
            )}
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Education" onEdit={() => goEdit('/passport/education')} />
            {profile.education.length ? (
              profile.education.map((edu) => (
                <div key={edu.id} className="cb-cand-details__kv cb-cand-details__edu">
                  <div className="kv">
                    <span className="k">DEGREE</span>
                    <span className="v">
                      {[edu.qualification, edu.fieldOfStudy].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                  <div className="kv">
                    <span className="k">INSTITUTE</span>
                    <span className="v">{edu.institution || '—'}</span>
                  </div>
                  <div className="kv">
                    <span className="k">GRADUATION</span>
                    <span className="v">{edu.yearCompleted || edu.endDate || '—'}</span>
                  </div>
                  <div className="kv">
                    <span className="k">PERIOD</span>
                    <span className="v">
                      {[edu.startDate, edu.endDate].filter(Boolean).join(' — ') || '—'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="cb-cand-details__empty">No education added yet.</p>
            )}
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Certifications" onEdit={() => goEdit('/passport/certifications')} />
            {profile.certifications.length ? (
              <div className="cb-cand-details__skills">
                {profile.certifications.map((c) => (
                  <span key={c.id}>{c.name}</span>
                ))}
              </div>
            ) : (
              <p className="cb-cand-details__empty">No certifications yet.</p>
            )}
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Projects" onEdit={() => goEdit('/passport/projects')} />
            {profile.projects.length ? (
              profile.projects.map((p) => (
                <div key={p.id} className="cb-cand-details__timeline">
                  <div className="dot-col">
                    <div className="dot" />
                  </div>
                  <div className="content">
                    <b>{p.title}</b>
                    <div className="org">{[p.role, p.year].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="cb-cand-details__empty">No projects yet.</p>
            )}
          </div>

          <div className="cb-cand-details__section">
            <SectionHead title="Links" onEdit={() => goEdit('/passport/links')} />
            {profile.links?.linkedin ||
            profile.links?.github ||
            profile.links?.portfolio ||
            profile.links?.website ? (
              <div className="cb-cand-details__kv">
                {profile.links.linkedin ? (
                  <div className="kv">
                    <span className="k">LINKEDIN</span>
                    <span className="v">{profile.links.linkedin}</span>
                  </div>
                ) : null}
                {profile.links.github ? (
                  <div className="kv">
                    <span className="k">GITHUB</span>
                    <span className="v">{profile.links.github}</span>
                  </div>
                ) : null}
                {profile.links.portfolio ? (
                  <div className="kv">
                    <span className="k">PORTFOLIO</span>
                    <span className="v">{profile.links.portfolio}</span>
                  </div>
                ) : null}
                {profile.links.website ? (
                  <div className="kv">
                    <span className="k">WEBSITE</span>
                    <span className="v">{profile.links.website}</span>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="cb-cand-details__empty">No links yet.</p>
            )}
          </div>

          <div className="cb-cand-details__section is-last">
            <SectionHead title="Resumes" onEdit={() => goEdit('/resumes')} />
            {resumes.length === 0 ? (
              <p className="cb-cand-details__empty">No resumes yet.</p>
            ) : (
              resumes.map((row) => (
                <div key={row.id} className="cb-cand-details__resume">
                  <div className="resume-left">
                    <div className="file-ic" aria-hidden>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c2822" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </div>
                    <div>
                      <div className="resume-name">{row.title}</div>
                      <div className="resume-meta">
                        {relativeUpdated(row.updatedAt)}
                        {row.score ? ` · Score ${row.score}` : ''}
                        {' · '}V{row.version}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-view"
                    onClick={() => void openResumePreview(row.id)}
                  >
                    View
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {previewOpen ? (
        <div className="cb-cand-resume-modal" role="dialog" aria-modal="true" aria-label="Resume preview">
          <button
            type="button"
            className="cb-cand-resume-modal__backdrop"
            aria-label="Close resume"
            onClick={closeResumePreview}
          />
          <div className="cb-cand-resume-modal__panel">
            <div className="cb-cand-resume-modal__bar">
              <h2>{previewTitle || 'Resume'}</h2>
              <button
                type="button"
                className="cb-cand-details__cut"
                aria-label="Close"
                onClick={closeResumePreview}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <div className="cb-cand-resume-modal__body">
              {previewLoading ? (
                <p className="cb-cand-details__empty" style={{ padding: 24 }}>
                  Opening resume…
                </p>
              ) : null}
              {previewError ? (
                <p className="text-sm font-semibold text-red-600" style={{ padding: 24 }}>
                  {previewError}
                </p>
              ) : null}
              {!previewLoading && templateData ? (
                <div className="cb-cand-resume-modal__sheet">
                  <div className="preview-sheet bg-white" style={{ width: 794, maxWidth: '100%' }}>
                    <Template data={templateData} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .cb-cand-details {
          --cd-dark: #0c2822;
          --cd-hair: #e7e9e0;
          --cd-ink: #16211d;
          --cd-ink-soft: #4a534d;
          --cd-muted: #7d857f;
          --cd-mint: #e7f1ea;
          --cd-good: #2f6b4f;
          --cd-good-soft: #e6f0e9;
          padding-bottom: 2.5rem;
        }
        .cb-cand-details__fx {
          opacity: 0;
          transform: translateY(10px);
          animation: cb-cand-fx-in 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @keyframes cb-cand-fx-in {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .cb-cand-details__back {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 18px;
          border: none;
          background: transparent;
          padding: 0;
          font-size: 13.5px;
          font-weight: 700;
          color: var(--cd-dark);
          cursor: pointer;
        }
        .cb-cand-details__back svg {
          width: 14px;
          height: 14px;
        }
        .cb-cand-details__box {
          overflow: hidden;
          border: 1.5px solid var(--cd-hair);
          border-radius: 16px;
          background: #fff;
        }
        .cb-cand-details__title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 28px;
          border-bottom: 1.5px solid var(--cd-hair);
        }
        .cb-cand-details__title h1 {
          margin: 0;
          font-family: var(--font-lora-details), Georgia, serif;
          font-size: 21px;
          font-weight: 700;
          color: var(--cd-ink);
        }
        .cb-cand-details__cut {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1.5px solid var(--cd-hair);
          background: #fff;
          color: var(--cd-dark);
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .cb-cand-details__cut:hover {
          background: var(--cd-mint);
          border-color: var(--cd-dark);
        }
        .cb-cand-details__edit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: 1.5px solid var(--cd-dark);
          background: #fff;
          color: var(--cd-dark);
          font-size: 12px;
          font-weight: 700;
          padding: 6px 12px;
          cursor: pointer;
          transition: background 0.15s ease;
          flex-shrink: 0;
        }
        .cb-cand-details__edit:hover {
          background: var(--cd-mint);
        }
        .cb-cand-details__sec-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }
        .cb-cand-details__sec-head h3 {
          margin: 0;
        }
        .cb-cand-details__profile {
          display: flex;
          gap: 18px;
          align-items: center;
          padding: 26px 28px;
          border-bottom: 1.5px solid var(--cd-hair);
        }
        .cb-cand-details__photo {
          flex: 0 0 84px;
          width: 84px;
          height: 84px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--cd-mint);
          border: 3px solid #fff;
          box-shadow: 0 0 0 1.5px var(--cd-hair);
          font-family: var(--font-lora-details), Georgia, serif;
          font-size: 28px;
          font-weight: 700;
          color: var(--cd-dark);
        }
        .cb-cand-details__photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .cb-cand-details__info {
          flex: 1;
          min-width: 0;
        }
        .cb-cand-details__info-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .cb-cand-details__info h2 {
          margin: 0 0 4px;
          font-family: var(--font-lora-details), Georgia, serif;
          font-size: 19px;
          font-weight: 700;
        }
        .cb-cand-details__info-top > div > p {
          margin: 0 0 8px;
          font-size: 13.5px;
          color: var(--cd-muted);
        }
        .cb-cand-details__tags {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cb-cand-details__tags span {
          font-size: 11px;
          font-weight: 700;
          background: var(--cd-good-soft);
          color: var(--cd-good);
          padding: 5px 10px;
          border-radius: 999px;
        }
        .cb-cand-details__summary {
          padding: 22px 28px;
          border-bottom: 1.5px solid var(--cd-hair);
        }
        .cb-cand-details__sec-label {
          margin: 0 0 10px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: var(--cd-muted);
        }
        .cb-cand-details__summary > p:last-child {
          margin: 10px 0 0;
          font-size: 14px;
          line-height: 1.65;
          color: var(--cd-ink-soft);
          white-space: pre-wrap;
        }
        .cb-cand-details__section {
          padding: 22px 28px;
          border-bottom: 1.5px solid var(--cd-hair);
        }
        .cb-cand-details__section.is-last {
          border-bottom: none;
        }
        .cb-cand-details__section h3 {
          margin: 0;
          font-family: var(--font-lora-details), Georgia, serif;
          font-size: 15.5px;
          font-weight: 700;
        }
        .cb-cand-details__exp-years {
          margin: 0 0 14px;
          font-size: 14px;
          color: #43526b;
        }
        .cb-cand-details__exp-years strong {
          color: #0c2822;
          font-weight: 700;
        }
        .cb-cand-details__kv {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 24px;
        }
        .cb-cand-details__edu + .cb-cand-details__edu {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--cd-hair);
        }
        .cb-cand-details__kv .k {
          display: block;
          margin-bottom: 3px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: var(--cd-muted);
        }
        .cb-cand-details__kv .v {
          font-size: 13.5px;
          font-weight: 600;
          color: var(--cd-ink);
          word-break: break-word;
        }
        .cb-cand-details__skills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cb-cand-details__skills span {
          font-size: 12.5px;
          font-weight: 700;
          background: var(--cd-mint);
          color: var(--cd-dark);
          padding: 7px 13px;
          border-radius: 8px;
        }
        .cb-cand-details__timeline {
          display: flex;
          gap: 14px;
          padding: 12px 0;
          border-bottom: 1px solid var(--cd-hair);
        }
        .cb-cand-details__timeline:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .cb-cand-details__timeline .dot-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 4px;
        }
        .cb-cand-details__timeline .dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--cd-dark);
        }
        .cb-cand-details__timeline .line {
          width: 1.5px;
          flex: 1;
          margin-top: 4px;
          background: var(--cd-hair);
        }
        .cb-cand-details__timeline .content b {
          display: block;
          font-size: 13.5px;
          font-weight: 700;
        }
        .cb-cand-details__timeline .org {
          font-size: 12.5px;
          color: var(--cd-ink-soft);
        }
        .cb-cand-details__timeline .dates {
          margin-top: 2px;
          font-size: 11.5px;
          color: var(--cd-muted);
        }
        .cb-cand-details__resume {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 13px 0;
          border-bottom: 1px solid var(--cd-hair);
        }
        .cb-cand-details__resume:last-child {
          border-bottom: none;
        }
        .cb-cand-details__resume .resume-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }
        .cb-cand-details__resume .file-ic {
          flex: 0 0 38px;
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: var(--cd-mint);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cb-cand-details__resume .resume-name {
          font-size: 13.5px;
          font-weight: 700;
        }
        .cb-cand-details__resume .resume-meta {
          margin-top: 1px;
          font-size: 11.5px;
          color: var(--cd-muted);
        }
        .cb-cand-details__resume .btn-view {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          border: 1.5px solid var(--cd-dark);
          border-radius: 8px;
          background: #fff;
          color: var(--cd-dark);
          font-size: 12.5px;
          font-weight: 700;
          padding: 8px 16px;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.15s ease;
        }
        .cb-cand-details__resume .btn-view:hover {
          background: var(--cd-mint);
          transform: translateY(-1px);
        }
        .cb-cand-details__empty {
          margin: 0;
          font-size: 13.5px;
          color: var(--cd-muted);
        }
        .cb-cand-resume-modal {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .cb-cand-resume-modal__backdrop {
          position: absolute;
          inset: 0;
          border: none;
          background: rgba(12, 40, 34, 0.55);
          cursor: pointer;
        }
        .cb-cand-resume-modal__panel {
          position: relative;
          z-index: 1;
          width: min(920px, 100%);
          max-height: min(92vh, 980px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
        }
        .cb-cand-resume-modal__bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 18px;
          border-bottom: 1.5px solid var(--cd-hair, #e7e9e0);
          background: #f7f8f4;
        }
        .cb-cand-resume-modal__bar h2 {
          margin: 0;
          font-family: var(--font-lora-details), Georgia, serif;
          font-size: 17px;
          font-weight: 700;
          color: #0c2822;
        }
        .cb-cand-resume-modal__body {
          overflow: auto;
          background: #eef0e8;
          padding: 16px;
        }
        .cb-cand-resume-modal__sheet {
          margin: 0 auto;
          width: fit-content;
          max-width: 100%;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
        }
        @media (max-width: 640px) {
          .cb-cand-details__title,
          .cb-cand-details__profile,
          .cb-cand-details__summary,
          .cb-cand-details__section {
            padding-left: 18px;
            padding-right: 18px;
          }
          .cb-cand-details__kv {
            grid-template-columns: 1fr;
          }
          .cb-cand-details__profile {
            flex-direction: column;
            align-items: flex-start;
          }
          .cb-cand-details__resume {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </CandidateAppShell>
  );
}
