'use client';

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  CAREER_GAP_REASON_LABELS,
  CAREER_GAP_REASONS,
  EDUCATION_LEVELS,
  LANGUAGE_LEVELS,
  ONBOARDING_DOMAINS,
  PREFERRED_LANGUAGES,
  parseLanguageSkills,
  profileLinkErrors,
  serializeLanguageSkills,
  type CandidateLinks,
  type CareerGapReasonCode,
  type LanguageSkill,
} from '@careerbridge/shared';
import { fieldsForQualification } from '@/data/degree-options';
import { INDIA_STATES } from '@/data/india-locations';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import {
  addCertification,
  addEducation,
  addExperience,
  addProject,
  addSkill,
  explainAllCareerGaps,
  getCandidateMe,
  getCareerGaps,
  updateCandidateMe,
} from '@/lib/api';
import { DatePicker } from '@/features/candidate/passport/DatePicker';
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';
import { skillsForDomain } from '@/data/technology-skills';

const ACCENT = '#0a2e2c';
const MUTED = '#6b6a63';
const BG = '#f7f6f2';
const LINE = '#e4e3de';
const TINT = '#E3F2ED';

const STEPS = [
  { key: 'basics', label: 'Profile' },
  { key: 'work', label: 'Skills' },
  { key: 'creds', label: 'Credentials' },
  { key: 'links', label: 'Links' },
  { key: 'gaps', label: 'Gaps' },
  { key: 'review', label: 'Review' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

type DraftEdu = {
  qualification: string;
  fieldOfStudy: string;
  institution: string;
  completedOn: string;
};
type DraftExp = {
  kind: 'job' | 'internship';
  company: string;
  jobTitle: string;
  years?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
};
type DraftProject = { title: string; description: string; url: string };
type DraftCert = { name: string; issuer: string; year: string };
type DraftAchieve = { title: string; organization: string; description: string };

const EXTRA_LINK_OPTIONS = [
  { key: 'github' as const, label: 'GitHub', hint: 'IT / developers' },
  { key: 'portfolio' as const, label: 'Portfolio', hint: 'Design / creative' },
  { key: 'website' as const, label: 'Website', hint: 'Personal site' },
];

const inputClass =
  'h-11 w-full rounded-xl border bg-white px-3.5 text-sm outline-none transition focus:border-[#0a2e2c] focus:shadow-[0_0_0_3px_#E3F2ED]';
const labelClass = 'mb-1.5 block text-[13px] font-medium';
const sectionTitleClass = 'text-xl font-semibold leading-tight';

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-xs" style={{ color: MUTED }}>
        <span>
          Step {step + 1} of {STEPS.length}
        </span>
        <span>{STEPS[step].label}</span>
      </div>
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className="h-1.5 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= step ? ACCENT : LINE }}
          />
        ))}
      </div>
    </div>
  );
}

function ChipBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
      style={
        active
          ? { background: ACCENT, borderColor: ACCENT, color: '#fff' }
          : { background: '#fff', borderColor: LINE, color: MUTED }
      }
    >
      {children}
    </button>
  );
}

export default function DossierFormPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Basics
  const [fullName, setFullName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [summary, setSummary] = useState('');
  const [edu, setEdu] = useState<DraftEdu>({
    qualification: '',
    fieldOfStudy: '',
    institution: '',
    completedOn: '',
  });
  const [experiences, setExperiences] = useState<DraftExp[]>([]);
  const [expMode, setExpMode] = useState<'none' | 'job' | 'internship' | null>(null);
  const [draftExp, setDraftExp] = useState<DraftExp>({
    kind: 'job',
    company: '',
    jobTitle: '',
    years: '',
    startDate: '',
    endDate: '',
    current: false,
  });

  // Skills + projects
  const [skills, setSkills] = useState<string[]>([]);
  const [projects, setProjects] = useState<DraftProject[]>([]);
  const [draftProject, setDraftProject] = useState<DraftProject>({
    title: '',
    description: '',
    url: '',
  });

  // Certs + achievements
  const [certs, setCerts] = useState<DraftCert[]>([]);
  const [draftCert, setDraftCert] = useState<DraftCert>({ name: '', issuer: '', year: '' });
  const [achievements, setAchievements] = useState<DraftAchieve[]>([]);
  const [draftAchieve, setDraftAchieve] = useState<DraftAchieve>({
    title: '',
    organization: '',
    description: '',
  });

  // Links
  const [links, setLinks] = useState<CandidateLinks>({
    linkedin: '',
    github: '',
    portfolio: '',
    website: '',
  });
  const [showOtherLinks, setShowOtherLinks] = useState(false);
  const [enabledExtras, setEnabledExtras] = useState<Array<'github' | 'portfolio' | 'website'>>([]);

  // Languages + prefs
  const [languages, setLanguages] = useState<LanguageSkill[]>([]);
  const [domain, setDomain] = useState('');
  const [openToRelocating, setOpenToRelocating] = useState(true);
  const skillSuggestions = useMemo(() => skillsForDomain(domain), [domain]);
  const [preferredRole, setPreferredRole] = useState('');

  // Career gaps (backend source of truth)
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState('');
  const [gapAnalysis, setGapAnalysis] = useState<{
    totalGaps: number;
    totalGapDays: number;
    totalGapDuration: string;
    gaps: Array<{
      id: string;
      startDate: string;
      endDate: string;
      dateRangeLabel: string;
      gapDays: number;
      duration: string;
      status: string;
    }>;
  } | null>(null);
  const [gapReason, setGapReason] = useState('');
  const [gapReasonDetails, setGapReasonDetails] = useState('');

  const fieldOptions = useMemo(
    () => fieldsForQualification(edu.qualification || 'Other'),
    [edu.qualification],
  );

  useEffect(() => {
    if (!getStoredUser()) {
      router.replace('/login');
      return;
    }
    getCandidateMe()
      .then((profile) => {
        setFullName(
          [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.firstName || '',
        );
        setState(profile.state || '');
        setCity(profile.city || profile.preferredWorkCity?.split(',')[0]?.trim() || '');
        setSummary(profile.about || '');
        const firstEdu = profile.education?.[0];
        if (firstEdu || profile.highestEducation) {
          setEdu({
            qualification: firstEdu?.qualification || profile.highestEducation || '',
            fieldOfStudy: firstEdu?.fieldOfStudy || '',
            institution: firstEdu?.institution || '',
            completedOn:
              (firstEdu as { endDate?: string | null })?.endDate?.slice(0, 7) ||
              profile.educationEnd?.slice(0, 7) ||
              (firstEdu?.yearCompleted ? `${firstEdu.yearCompleted}-06` : ''),
          });
        }
        if (profile.experiences?.length) {
          setExperiences(
            profile.experiences.map((e) => ({
              kind: e.isInternship ? 'internship' : 'job',
              company: e.company,
              jobTitle: e.jobTitle,
              startDate: e.startDate?.slice(0, 7) || '',
              endDate: e.endDate?.slice(0, 7) || '',
              current: e.stillInCompany,
            })),
          );
          setExpMode(profile.experiences.some((e) => e.isInternship) ? 'internship' : 'job');
        } else if (profile.hasExperience === 'NONE') {
          setExpMode('none');
        }
        setSkills((profile.skills || []).map((s) => s.name).filter(Boolean));
        setProjects(
          (profile.projects || []).map((p) => ({
            title: p.title,
            description: p.description || '',
            url: p.url || '',
          })),
        );
        const allCerts = profile.certifications || [];
        setCerts(
          allCerts
            .filter((c) => c.credentialId !== '#achievement')
            .map((c) => ({
              name: c.name,
              issuer: c.issuer || '',
              year: c.year ? String(c.year) : '',
            })),
        );
        setAchievements(
          allCerts
            .filter((c) => c.credentialId === '#achievement')
            .map((c) => ({
              title: c.name,
              organization: c.issuer || '',
              description: '',
            })),
        );
        const L = { linkedin: '', github: '', portfolio: '', website: '', ...profile.links };
        setLinks(L);
        const extras: Array<'github' | 'portfolio' | 'website'> = [];
        if (L.github) extras.push('github');
        if (L.portfolio) extras.push('portfolio');
        if (L.website) extras.push('website');
        if (extras.length) {
          setEnabledExtras(extras);
          setShowOtherLinks(true);
        }
        setLanguages(parseLanguageSkills(profile.preferredLanguage));
        setDomain(profile.careerInterests?.[0] || '');
        setOpenToRelocating(profile.openToRelocating ?? true);
      })
      .finally(() => setReady(true));
  }, [router]);

  function addSkillChip(name: string) {
    const v = name.trim();
    if (!v) return;
    if (!skills.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setSkills((prev) => [...prev, v]);
    }
  }

  function commitExp() {
    if (draftExp.company.trim().length < 2 || draftExp.jobTitle.trim().length < 2) {
      setError('Enter company and role for this entry.');
      return;
    }
    setExperiences((prev) => [...prev, { ...draftExp }]);
    setDraftExp({
      kind: draftExp.kind,
      company: '',
      jobTitle: '',
      years: '',
      startDate: '',
      endDate: '',
      current: false,
    });
    setError('');
  }

  function commitProject() {
    if (draftProject.title.trim().length < 2) {
      setError('Enter a project title.');
      return;
    }
    setProjects((prev) => [...prev, { ...draftProject }]);
    setDraftProject({ title: '', description: '', url: '' });
    setError('');
  }

  function commitCert() {
    if (draftCert.name.trim().length < 2) {
      setError('Enter a certification name.');
      return;
    }
    setCerts((prev) => [...prev, { ...draftCert }]);
    setDraftCert({ name: '', issuer: '', year: '' });
    setError('');
  }

  function commitAchieve() {
    if (draftAchieve.title.trim().length < 2) {
      setError('Enter an achievement title.');
      return;
    }
    setAchievements((prev) => [...prev, { ...draftAchieve }]);
    setDraftAchieve({ title: '', organization: '', description: '' });
    setError('');
  }

  async function loadCareerGaps(): Promise<{ totalGaps: number }> {
    setGapLoading(true);
    setGapError('');
    try {
      // Persist education/experience draft first so fresher → now gaps use live data.
      await updateCandidateMe({
        highestEducation: edu.qualification || undefined,
        educationEnd: edu.completedOn || undefined,
        stillInCollege: false,
        hasExperience:
          expMode === 'job' ? 'YES' : expMode === 'internship' ? 'INTERNSHIP' : 'NONE',
        experienceLevel: expMode === 'job' ? 'experienced' : 'fresher',
      });

      const profile = await getCandidateMe();
      if (!profile.education?.length && edu.qualification) {
        const year = edu.completedOn ? Number(edu.completedOn.slice(0, 4)) : undefined;
        await addEducation({
          qualification: edu.qualification,
          fieldOfStudy: edu.fieldOfStudy || undefined,
          institution: edu.institution || undefined,
          yearCompleted: Number.isFinite(year) ? year : undefined,
        });
      }
      if (!(profile.experiences?.length > 0) && experiences.length > 0) {
        for (const row of experiences) {
          await addExperience({
            company: row.company.trim(),
            jobTitle: row.jobTitle.trim(),
            startDate: row.startDate ? `${row.startDate}-01` : undefined,
            endDate: row.current || !row.endDate ? undefined : `${row.endDate}-01`,
            stillInCompany: Boolean(row.current),
            isInternship: row.kind === 'internship',
          });
        }
      }

      const data = await getCareerGaps();
      setGapAnalysis({
        totalGaps: data.totalGaps,
        totalGapDays: data.totalGapDays,
        totalGapDuration: data.totalGapDuration,
        gaps: data.gaps.map((g) => ({
          id: g.id,
          startDate: g.startDate,
          endDate: g.endDate,
          dateRangeLabel: g.dateRangeLabel,
          gapDays: g.gapDays,
          duration: g.duration,
          status: g.status,
        })),
      });
      const explained = data.gaps.find((g) => g.reason);
      if (explained?.reason) {
        setGapReason(explained.reason);
        setGapReasonDetails(explained.reasonDetails || '');
      }
      return { totalGaps: data.totalGaps };
    } catch {
      // Soft-skip: never block onboarding on gap calc failures.
      setGapAnalysis({
        totalGaps: 0,
        totalGapDays: 0,
        totalGapDuration: '0 days',
        gaps: [],
      });
      setGapError('');
      return { totalGaps: 0 };
    } finally {
      setGapLoading(false);
    }
  }

  function validateStep(i: number): boolean {
    if (i === 0) {
      if (fullName.trim().length < 2) {
        setError('Enter your full name.');
        return false;
      }
      if (!edu.qualification) {
        setError('Select your highest education.');
        return false;
      }
      if (expMode === null) {
        setError('Choose whether you have experience or internships.');
        return false;
      }
      if ((expMode === 'job' || expMode === 'internship') && experiences.length < 1) {
        setError(`Add at least one ${expMode === 'job' ? 'experience' : 'internship'}.`);
        return false;
      }
    }
    if (i === 3) {
      const errs = profileLinkErrors(links);
      if (Object.keys(errs).length) {
        setError(Object.values(errs)[0] || 'Fix your links.');
        return false;
      }
    }
    if (i === 4) {
      if (gapLoading) {
        setError('Career gap analysis is still loading. Please wait.');
        return false;
      }
      if (gapAnalysis && gapAnalysis.totalGaps > 0) {
        if (!gapReason) {
          setError('Please select a reason for your career gap.');
          return false;
        }
        if (gapReason === 'OTHER' && gapReasonDetails.trim().length < 2) {
          setError('Please specify details when the reason is Other.');
          return false;
        }
      }
    }
    if (i === 5) {
      if (!languages.length) {
        setError('Select at least one language.');
        return false;
      }
      if (languages.some((l) => !l.level)) {
        setError('Choose a level for each language.');
        return false;
      }
    }
    setError('');
    return true;
  }

  async function goNext() {
    if (!validateStep(step)) return;
    const next = Math.min(step + 1, STEPS.length - 1);
    if (STEPS[next].key === 'gaps') {
      setLoading(true);
      setError('');
      try {
        const result = await loadCareerGaps();
        if (result.totalGaps > 0) {
          setStep(next);
        } else {
          // No gaps (or calc failed soft) — skip the gaps slide entirely.
          setStep(Math.min(next + 1, STEPS.length - 1));
        }
      } finally {
        setLoading(false);
      }
      return;
    }
    if (STEPS[step].key === 'gaps' && gapAnalysis && gapAnalysis.totalGaps > 0) {
      setLoading(true);
      try {
        await explainAllCareerGaps({
          reason: gapReason,
          reasonDetails: gapReasonDetails.trim() || undefined,
        });
      } catch {
        setError('Could not save career gap explanation. Please try again.');
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    }
    setStep(next);
  }

  function goBack() {
    setError('');
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validateStep(5)) return;
    setLoading(true);
    setError('');
    try {
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || undefined;

      const profile = await getCandidateMe();

      await updateCandidateMe({
        firstName,
        lastName,
        state: state || undefined,
        city: city || undefined,
        about: [summary.trim(), preferredRole.trim() ? `Preferred role: ${preferredRole.trim()}` : '']
          .filter(Boolean)
          .join('\n') || undefined,
        highestEducation: edu.qualification,
        educationEnd: edu.completedOn || undefined,
        stillInCollege: false,
        hasExperience:
          expMode === 'job' ? 'YES' : expMode === 'internship' ? 'INTERNSHIP' : 'NONE',
        experienceLevel: expMode === 'job' ? 'experienced' : 'fresher',
        links,
        preferredLanguage: serializeLanguageSkills(languages),
        careerInterests: domain ? [domain] : profile.careerInterests,
        openToRelocating,
        onboardingCompleted: true,
      });

      if (!profile.education?.length && edu.qualification) {
        const year = edu.completedOn ? Number(edu.completedOn.slice(0, 4)) : undefined;
        await addEducation({
          qualification: edu.qualification,
          fieldOfStudy: edu.fieldOfStudy || undefined,
          institution: edu.institution || undefined,
          yearCompleted: Number.isFinite(year) ? year : undefined,
        });
      }

      const existingExpCount = profile.experiences?.length || 0;
      if (existingExpCount === 0) {
        for (const row of experiences) {
          await addExperience({
            company: row.company.trim(),
            jobTitle: row.jobTitle.trim(),
            startDate: row.startDate ? `${row.startDate}-01` : undefined,
            endDate: row.current || !row.endDate ? undefined : `${row.endDate}-01`,
            stillInCompany: Boolean(row.current),
            isInternship: row.kind === 'internship',
          });
        }
      }

      const existingSkillNames = new Set(
        (profile.skills || []).map((s) => s.name.toLowerCase()),
      );
      for (const name of skills) {
        if (!existingSkillNames.has(name.toLowerCase())) {
          await addSkill({ name });
        }
      }

      if (!(profile.projects?.length > 0)) {
        for (const p of projects) {
          await addProject({
            title: p.title.trim(),
            description: p.description.trim() || undefined,
            url: p.url.trim() || undefined,
          });
        }
      }

      if (!(profile.certifications?.length > 0)) {
        for (const c of certs) {
          await addCertification({
            name: c.name.trim(),
            issuer: c.issuer.trim() || undefined,
            year: c.year ? Number(c.year) : undefined,
          });
        }
        for (const a of achievements) {
          await addCertification({
            name: a.title.trim(),
            issuer: a.organization.trim() || 'Achievement',
            credentialId: '#achievement',
          });
        }
      }

      patchStoredUser({ firstName, onboardingCompleted: true });
      router.replace('/onboarding/complete');
    } catch {
      setError('Could not save your dossier. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm" style={{ background: BG, color: MUTED }}>
        Loading dossier…
      </main>
    );
  }

  const stepKey = STEPS[step].key as StepKey;

  return (
    <main className="min-h-dvh px-4 py-6 sm:px-6" style={{ background: BG, color: ACCENT }}>
      <form
        onSubmit={onSubmit}
        className="mx-auto flex min-h-[min(92dvh,820px)] w-full max-w-lg flex-col rounded-3xl border bg-white p-5 shadow-sm sm:p-7"
        style={{ borderColor: LINE }}
      >
        <ProgressBar step={step} />

        <div className="cb-ob-hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto pb-4">
          {stepKey === 'basics' && (
            <>
              <div>
                <p
                  className="text-xs tracking-wide"
                  style={{ color: MUTED, fontFamily: 'var(--font-space-mono), monospace' }}
                >
                  Section 1
                </p>
                <h2
                  className={sectionTitleClass}
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
                >
                  Personal, education & experience
                </h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  Core profile details reviewers check first.
                </p>
              </div>

              <div>
                <label className={labelClass} style={{ color: MUTED }}>
                  Full name
                </label>
                <input
                  className={inputClass}
                  style={{ borderColor: LINE }}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} style={{ color: MUTED }}>
                    State
                  </label>
                  <select
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  >
                    <option value="">Select</option>
                    {INDIA_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass} style={{ color: MUTED }}>
                    City
                  </label>
                  <input
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: MUTED }}>
                  Short summary (optional)
                </label>
                <textarea
                  className="min-h-[72px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a2e2c] focus:shadow-[0_0_0_3px_#E3F2ED]"
                  style={{ borderColor: LINE }}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="One or two lines about you"
                />
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-3 text-sm font-semibold">Education</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass} style={{ color: MUTED }}>
                      Highest qualification
                    </label>
                    <select
                      className={inputClass}
                      style={{ borderColor: LINE }}
                      value={edu.qualification}
                      onChange={(e) =>
                        setEdu((d) => ({ ...d, qualification: e.target.value, fieldOfStudy: '' }))
                      }
                    >
                      <option value="">Select</option>
                      {EDUCATION_LEVELS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: MUTED }}>
                      Field of study
                    </label>
                    <select
                      className={inputClass}
                      style={{ borderColor: LINE }}
                      value={edu.fieldOfStudy}
                      onChange={(e) => setEdu((d) => ({ ...d, fieldOfStudy: e.target.value }))}
                      disabled={!edu.qualification}
                    >
                      <option value="">Select</option>
                      {fieldOptions.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: MUTED }}>
                      Institution (optional)
                    </label>
                    <input
                      className={inputClass}
                      style={{ borderColor: LINE }}
                      value={edu.institution}
                      onChange={(e) => setEdu((d) => ({ ...d, institution: e.target.value }))}
                      placeholder="College / school"
                    />
                  </div>
                  <div>
                    <label className={labelClass} style={{ color: MUTED }}>
                      Graduation / completion month
                    </label>
                    <DatePicker
                      mode="month"
                      value={edu.completedOn}
                      onChange={(v) => setEdu((d) => ({ ...d, completedOn: v }))}
                      placeholder="Select month"
                      confirmLabel="Set completion date"
                    />
                    <p className="mt-1 text-[11px]" style={{ color: MUTED }}>
                      Used to detect career gaps for freshers (e.g. March 2026 → now).
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-2 text-sm font-semibold">Experience</p>
                <p className="mb-3 text-xs" style={{ color: MUTED }}>
                  Freshers can add internships instead of full-time roles.
                </p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      { id: 'job' as const, label: 'Add experience' },
                      { id: 'internship' as const, label: 'Add internship' },
                      { id: 'none' as const, label: 'No experience yet' },
                    ] as const
                  ).map((opt) => (
                    <ChipBtn
                      key={opt.id}
                      active={expMode === opt.id}
                      onClick={() => {
                        setExpMode(opt.id);
                        setDraftExp((d) => ({
                          ...d,
                          kind: opt.id === 'internship' ? 'internship' : 'job',
                        }));
                        setError('');
                      }}
                    >
                      {opt.label}
                    </ChipBtn>
                  ))}
                </div>

                {experiences.length > 0 ? (
                  <ul className="mb-3 space-y-2">
                    {experiences.map((row, idx) => (
                      <li
                        key={`${row.company}-${idx}`}
                        className="flex items-start justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-sm"
                        style={{ borderColor: LINE }}
                      >
                        <div>
                          <p className="font-medium">
                            {row.jobTitle} · {row.company}
                          </p>
                          <p className="text-xs" style={{ color: MUTED }}>
                            {row.kind === 'internship' ? 'Internship' : 'Experience'}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-xs font-medium"
                          style={{ color: MUTED }}
                          onClick={() => setExperiences((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {(expMode === 'job' || expMode === 'internship') && (
                  <div className="space-y-3 rounded-xl border bg-white p-3" style={{ borderColor: LINE }}>
                    <div>
                      <label className={labelClass} style={{ color: MUTED }}>
                        Role
                      </label>
                      <input
                        className={inputClass}
                        style={{ borderColor: LINE }}
                        value={draftExp.jobTitle}
                        onChange={(e) => setDraftExp((d) => ({ ...d, jobTitle: e.target.value }))}
                        placeholder={expMode === 'internship' ? 'Intern' : 'e.g. Sales executive'}
                      />
                    </div>
                    <div>
                      <label className={labelClass} style={{ color: MUTED }}>
                        Company / organisation
                      </label>
                      <input
                        className={inputClass}
                        style={{ borderColor: LINE }}
                        value={draftExp.company}
                        onChange={(e) => setDraftExp((d) => ({ ...d, company: e.target.value }))}
                        placeholder="Organisation name"
                      />
                    </div>
                    {expMode === 'job' ? (
                      <div>
                        <label className={labelClass} style={{ color: MUTED }}>
                          Years of experience
                        </label>
                        <input
                          inputMode="decimal"
                          className={inputClass}
                          style={{ borderColor: LINE }}
                          value={draftExp.years || ''}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, '');
                            const parts = raw.split('.');
                            const cleaned =
                              parts.length <= 1
                                ? raw
                                : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
                            setDraftExp((d) => ({ ...d, years: cleaned }));
                          }}
                          placeholder="e.g. 1.5"
                        />
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={labelClass} style={{ color: MUTED }}>
                          From
                        </label>
                        <DatePicker
                          mode="month"
                          value={draftExp.startDate || ''}
                          onChange={(v) => setDraftExp((d) => ({ ...d, startDate: v }))}
                          placeholder="Select month"
                          confirmLabel="Set start date"
                        />
                      </div>
                      <div>
                        <label className={labelClass} style={{ color: MUTED }}>
                          To
                        </label>
                        <DatePicker
                          mode="month"
                          value={draftExp.current ? '' : draftExp.endDate || ''}
                          onChange={(v) => setDraftExp((d) => ({ ...d, endDate: v }))}
                          placeholder="Select month"
                          confirmLabel="Set end date"
                          disabled={Boolean(draftExp.current)}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={Boolean(draftExp.current)}
                        onChange={(e) =>
                          setDraftExp((d) => ({
                            ...d,
                            current: e.target.checked,
                            endDate: e.target.checked ? '' : d.endDate,
                          }))
                        }
                      />
                      Currently here
                    </label>
                    <button
                      type="button"
                      onClick={commitExp}
                      className="h-10 w-full rounded-full text-sm font-semibold text-white"
                      style={{ background: ACCENT }}
                    >
                      {expMode === 'internship' ? 'Save internship' : 'Save experience'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {stepKey === 'work' && (
            <>
              <div>
                <p
                  className="text-xs tracking-wide"
                  style={{ color: MUTED, fontFamily: 'var(--font-space-mono), monospace' }}
                >
                  Section 2
                </p>
                <h2
                  className={sectionTitleClass}
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
                >
                  Skills & projects
                </h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  Show what you can do and what you have built.
                </p>
              </div>

              <div>
                <label className={labelClass} style={{ color: MUTED }}>
                  Domain (for skill suggestions)
                </label>
                <div className="mb-3 flex flex-wrap gap-2">
                  {ONBOARDING_DOMAINS.map((d) => (
                    <ChipBtn key={d} active={domain === d} onClick={() => setDomain(d)}>
                      {d}
                    </ChipBtn>
                  ))}
                </div>
                <SkillSearchCombobox
                  label="Skills"
                  selected={skills}
                  options={skillSuggestions}
                  placeholder={
                    domain
                      ? `Search ${domain} skills or type to add…`
                      : 'Search skills or type to add…'
                  }
                  onAdd={(skill) => addSkillChip(skill)}
                  onRemove={(skill) => setSkills((prev) => prev.filter((x) => x !== skill))}
                />
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-3 text-sm font-semibold">Projects</p>
                {projects.length > 0 ? (
                  <ul className="mb-3 space-y-2">
                    {projects.map((p, idx) => (
                      <li
                        key={`${p.title}-${idx}`}
                        className="flex justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-sm"
                        style={{ borderColor: LINE }}
                      >
                        <span className="font-medium">{p.title}</span>
                        <button
                          type="button"
                          className="text-xs"
                          style={{ color: MUTED }}
                          onClick={() => setProjects((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="space-y-3">
                  <input
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={draftProject.title}
                    onChange={(e) => setDraftProject((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Project title"
                  />
                  <textarea
                    className="min-h-[64px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a2e2c]"
                    style={{ borderColor: LINE }}
                    value={draftProject.description}
                    onChange={(e) => setDraftProject((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Brief description (optional)"
                  />
                  <input
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={draftProject.url}
                    onChange={(e) => setDraftProject((d) => ({ ...d, url: e.target.value }))}
                    placeholder="Project link (optional)"
                  />
                  <button
                    type="button"
                    onClick={commitProject}
                    className="h-10 w-full rounded-full text-sm font-semibold text-white"
                    style={{ background: ACCENT }}
                  >
                    Save project
                  </button>
                </div>
              </div>
            </>
          )}

          {stepKey === 'creds' && (
            <>
              <div>
                <p
                  className="text-xs tracking-wide"
                  style={{ color: MUTED, fontFamily: 'var(--font-space-mono), monospace' }}
                >
                  Section 3
                </p>
                <h2
                  className={sectionTitleClass}
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
                >
                  Certifications & achievements
                </h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  Optional — add what strengthens your profile.
                </p>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-3 text-sm font-semibold">Certifications</p>
                {certs.length > 0 ? (
                  <ul className="mb-3 space-y-2">
                    {certs.map((c, idx) => (
                      <li
                        key={`${c.name}-${idx}`}
                        className="flex justify-between rounded-xl border bg-white px-3 py-2 text-sm"
                        style={{ borderColor: LINE }}
                      >
                        <span>
                          {c.name}
                          {c.issuer ? ` · ${c.issuer}` : ''}
                        </span>
                        <button
                          type="button"
                          className="text-xs"
                          style={{ color: MUTED }}
                          onClick={() => setCerts((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="space-y-2">
                  <input
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={draftCert.name}
                    onChange={(e) => setDraftCert((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Certification name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className={inputClass}
                      style={{ borderColor: LINE }}
                      value={draftCert.issuer}
                      onChange={(e) => setDraftCert((d) => ({ ...d, issuer: e.target.value }))}
                      placeholder="Issuer"
                    />
                    <input
                      className={inputClass}
                      style={{ borderColor: LINE }}
                      value={draftCert.year}
                      onChange={(e) => setDraftCert((d) => ({ ...d, year: e.target.value }))}
                      placeholder="Year"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={commitCert}
                    className="h-10 w-full rounded-full text-sm font-semibold text-white"
                    style={{ background: ACCENT }}
                  >
                    Save certification
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-3 text-sm font-semibold">Achievements</p>
                {achievements.length > 0 ? (
                  <ul className="mb-3 space-y-2">
                    {achievements.map((a, idx) => (
                      <li
                        key={`${a.title}-${idx}`}
                        className="flex justify-between rounded-xl border bg-white px-3 py-2 text-sm"
                        style={{ borderColor: LINE }}
                      >
                        <span>{a.title}</span>
                        <button
                          type="button"
                          className="text-xs"
                          style={{ color: MUTED }}
                          onClick={() => setAchievements((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="space-y-2">
                  <input
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={draftAchieve.title}
                    onChange={(e) => setDraftAchieve((d) => ({ ...d, title: e.target.value }))}
                    placeholder="Achievement title"
                  />
                  <input
                    className={inputClass}
                    style={{ borderColor: LINE }}
                    value={draftAchieve.organization}
                    onChange={(e) => setDraftAchieve((d) => ({ ...d, organization: e.target.value }))}
                    placeholder="Organisation (optional)"
                  />
                  <button
                    type="button"
                    onClick={commitAchieve}
                    className="h-10 w-full rounded-full text-sm font-semibold text-white"
                    style={{ background: ACCENT }}
                  >
                    Save achievement
                  </button>
                </div>
              </div>
            </>
          )}

          {stepKey === 'links' && (
            <>
              <div>
                <p
                  className="text-xs tracking-wide"
                  style={{ color: MUTED, fontFamily: 'var(--font-space-mono), monospace' }}
                >
                  Section 4
                </p>
                <h2
                  className={sectionTitleClass}
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
                >
                  Professional links
                </h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  LinkedIn first — add more if you have them.
                </p>
              </div>

              <div>
                <label className={labelClass} style={{ color: MUTED }}>
                  LinkedIn
                </label>
                <input
                  className={inputClass}
                  style={{ borderColor: LINE }}
                  value={links.linkedin || ''}
                  onChange={(e) => setLinks((l) => ({ ...l, linkedin: e.target.value }))}
                  placeholder="https://www.linkedin.com/in/your-name"
                />
              </div>

              {!showOtherLinks ? (
                <button
                  type="button"
                  onClick={() => setShowOtherLinks(true)}
                  className="h-11 w-full rounded-full text-sm font-semibold text-white"
                  style={{ background: ACCENT }}
                >
                  Add other links
                </button>
              ) : (
                <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                  <p className="text-sm font-semibold">Other links</p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    Pick what fits IT or non-IT profiles.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXTRA_LINK_OPTIONS.map((opt) => {
                      const on = enabledExtras.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setEnabledExtras((prev) =>
                              on ? prev.filter((k) => k !== opt.key) : [...prev, opt.key],
                            );
                          }}
                          className="rounded-full border px-3 py-1.5 text-xs font-medium"
                          style={
                            on
                              ? { background: ACCENT, borderColor: ACCENT, color: '#fff' }
                              : { background: '#fff', borderColor: LINE, color: MUTED }
                          }
                        >
                          {opt.label}
                          <span className="ml-1 opacity-70">· {opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  {enabledExtras.map((key) => {
                    const meta = EXTRA_LINK_OPTIONS.find((o) => o.key === key)!;
                    return (
                      <div key={key}>
                        <label className={labelClass} style={{ color: MUTED }}>
                          {meta.label}
                        </label>
                        <input
                          className={inputClass}
                          style={{ borderColor: LINE }}
                          value={links[key] || ''}
                          onChange={(e) => setLinks((l) => ({ ...l, [key]: e.target.value }))}
                          placeholder={
                            key === 'github'
                              ? 'https://github.com/you'
                              : key === 'portfolio'
                                ? 'https://yourwork.com'
                                : 'https://yoursite.com'
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {stepKey === 'gaps' && (
            <>
              <div>
                <p
                  className="text-xs tracking-wide"
                  style={{ color: MUTED, fontFamily: 'var(--font-space-mono), monospace' }}
                >
                  Section 5
                </p>
                <h2
                  className={sectionTitleClass}
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
                >
                  Career Gap Analysis
                </h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  We review your career timeline for gaps longer than 30 days.
                </p>
              </div>

              {gapLoading ? (
                <div
                  className="rounded-2xl border p-5 text-center"
                  style={{ borderColor: LINE, background: '#fafaf8' }}
                >
                  <p className="text-sm font-semibold">Analyzing your career journey…</p>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: MUTED }}>
                    We&apos;re reviewing your education and career history to identify any gaps
                    longer than 30 days.
                  </p>
                </div>
              ) : null}

              {!gapLoading && gapAnalysis && gapAnalysis.totalGaps > 0 ? (
                <div className="space-y-4">
                  <div
                    className="rounded-2xl border p-4"
                    style={{ borderColor: LINE, background: '#fafaf8' }}
                  >
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                      Based on the career information you provided, we identified{' '}
                      <strong style={{ color: ACCENT }}>
                        {gapAnalysis.totalGaps} career gap
                        {gapAnalysis.totalGaps === 1 ? '' : 's'}
                      </strong>{' '}
                      totaling <strong style={{ color: ACCENT }}>{gapAnalysis.totalGapDuration}</strong>.
                    </p>
                  </div>

                  {gapAnalysis.gaps.map((gap, idx) => (
                    <div
                      key={gap.id}
                      className="rounded-2xl border p-4"
                      style={{ borderColor: LINE, background: '#fff' }}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: ACCENT }}
                          aria-hidden
                        >
                          !
                        </span>
                        <div>
                          <p className="text-sm font-semibold">Career Gap {idx + 1}</p>
                          <p className="text-sm" style={{ color: MUTED }}>
                            {gap.dateRangeLabel}
                          </p>
                          <p className="mt-1 text-xs" style={{ color: MUTED }}>
                            Duration: {gap.duration} ({gap.gapDays} days)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  <div
                    className="rounded-2xl border p-4 text-sm font-semibold"
                    style={{ borderColor: ACCENT, background: TINT }}
                  >
                    Total identified career gap: {gapAnalysis.totalGapDuration} (
                    {gapAnalysis.totalGapDays} days)
                  </div>

                  <div
                    className="rounded-2xl border p-4 space-y-3"
                    style={{ borderColor: LINE, background: '#fff' }}
                  >
                    <p className="text-sm font-semibold">Explain your career gap</p>
                    <p className="text-xs" style={{ color: MUTED }}>
                      One explanation covers all gaps listed above.
                    </p>
                    <div>
                      <label className={labelClass} style={{ color: MUTED }}>
                        Why was there a career gap during this period?
                      </label>
                      <select
                        className={inputClass}
                        style={{ borderColor: LINE }}
                        value={gapReason}
                        onChange={(e) => {
                          setGapReason(e.target.value);
                          setError('');
                        }}
                      >
                        <option value="">Select reason</option>
                        {CAREER_GAP_REASONS.map((code) => (
                          <option key={code} value={code}>
                            {CAREER_GAP_REASON_LABELS[code as CareerGapReasonCode]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {gapReason === 'OTHER' ? (
                      <div>
                        <label className={labelClass} style={{ color: MUTED }}>
                          Please specify
                        </label>
                        <input
                          className={inputClass}
                          style={{ borderColor: LINE }}
                          value={gapReasonDetails}
                          maxLength={1000}
                          onChange={(e) => setGapReasonDetails(e.target.value)}
                          placeholder="Briefly describe the reason"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className={labelClass} style={{ color: MUTED }}>
                          Additional details (optional)
                        </label>
                        <textarea
                          className="min-h-[64px] w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0a2e2c]"
                          style={{ borderColor: LINE }}
                          value={gapReasonDetails}
                          maxLength={1000}
                          onChange={(e) => setGapReasonDetails(e.target.value)}
                          placeholder="Optional context"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {stepKey === 'review' && (
            <>
              <div>
                <p
                  className="text-xs tracking-wide"
                  style={{ color: MUTED, fontFamily: 'var(--font-space-mono), monospace' }}
                >
                  Section 6
                </p>
                <h2
                  className={sectionTitleClass}
                  style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}
                >
                  Languages, preferences & review
                </h2>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>
                  Finish preferences, then confirm everything looks right.
                </p>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-2 text-sm font-semibold">Languages</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {PREFERRED_LANGUAGES.map((name) => (
                    <ChipBtn
                      key={name}
                      active={languages.some((l) => l.name === name)}
                      onClick={() =>
                        setLanguages((cur) =>
                          cur.some((l) => l.name === name)
                            ? cur.filter((l) => l.name !== name)
                            : [...cur, { name, level: '' }],
                        )
                      }
                    >
                      {name}
                    </ChipBtn>
                  ))}
                </div>
                {languages.map((lang) => (
                  <div key={lang.name} className="mb-2 rounded-xl border bg-white p-3" style={{ borderColor: LINE }}>
                    <p className="mb-1.5 text-sm font-medium">{lang.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGE_LEVELS.map((level) => (
                        <ChipBtn
                          key={level}
                          active={lang.level === level}
                          onClick={() =>
                            setLanguages((cur) =>
                              cur.map((l) => (l.name === lang.name ? { ...l, level } : l)),
                            )
                          }
                        >
                          {level}
                        </ChipBtn>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: LINE, background: '#fafaf8' }}>
                <p className="mb-2 text-sm font-semibold">Preferences</p>
                <label className={labelClass} style={{ color: MUTED }}>
                  Domain
                </label>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ONBOARDING_DOMAINS.map((d) => (
                    <ChipBtn key={d} active={domain === d} onClick={() => setDomain(d)}>
                      {d}
                    </ChipBtn>
                  ))}
                </div>
                <label className={labelClass} style={{ color: MUTED }}>
                  Preferred role (optional)
                </label>
                <input
                  className={inputClass}
                  style={{ borderColor: LINE }}
                  value={preferredRole}
                  onChange={(e) => setPreferredRole(e.target.value)}
                  placeholder="e.g. Frontend developer"
                />
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={openToRelocating}
                    onChange={(e) => setOpenToRelocating(e.target.checked)}
                  />
                  Open to relocating
                </label>
              </div>

              <div className="rounded-2xl border p-4" style={{ borderColor: ACCENT, background: TINT }}>
                <p className="mb-3 text-sm font-semibold">Quick review</p>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Name</dt>
                    <dd className="text-right font-medium">{fullName || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Location</dt>
                    <dd className="text-right font-medium">
                      {[city, state].filter(Boolean).join(', ') || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Education</dt>
                    <dd className="text-right font-medium">
                      {[edu.qualification, edu.fieldOfStudy].filter(Boolean).join(' · ') || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Experience</dt>
                    <dd className="text-right font-medium">
                      {expMode === 'none'
                        ? 'Fresher'
                        : experiences.length
                          ? `${experiences.length} entr${experiences.length === 1 ? 'y' : 'ies'}`
                          : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Skills</dt>
                    <dd className="text-right font-medium">{skills.length || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Projects</dt>
                    <dd className="text-right font-medium">{projects.length || '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Certs / achievements</dt>
                    <dd className="text-right font-medium">
                      {certs.length + achievements.length || '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b pb-2" style={{ borderColor: 'rgba(10,46,44,0.12)' }}>
                    <dt style={{ color: MUTED }}>Career gaps</dt>
                    <dd className="text-right font-medium">
                      {gapAnalysis
                        ? gapAnalysis.totalGaps
                          ? `${gapAnalysis.totalGaps} · ${gapAnalysis.totalGapDuration}`
                          : 'None significant'
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt style={{ color: MUTED }}>LinkedIn</dt>
                    <dd className="max-w-[60%] truncate text-right font-medium">
                      {links.linkedin || '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}

          {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>

        <div className="mt-auto flex gap-2.5 border-t pt-4" style={{ borderColor: LINE }}>
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="h-12 flex-1 rounded-full border text-sm font-semibold"
              style={{ borderColor: LINE, color: ACCENT }}
            >
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="h-12 flex-[2] rounded-full text-sm font-semibold text-white"
              style={{ background: ACCENT }}
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="h-12 flex-[2] rounded-full text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {loading ? 'Saving…' : 'Submit dossier'}
            </button>
          )}
        </div>
      </form>
    </main>
  );
}
