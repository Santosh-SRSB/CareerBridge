'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ResumePreviewScreen } from '@/components/resume/ResumePreviewScreen';
import {
  AchievementInlineForm,
  CertificationInlineForm,
  EducationInlineForm,
  ExperienceInlineForm,
  ProjectInlineForm,
} from '@/components/resume/ResumeEntryForms';
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';
import { StateCitySelect } from '@/components/resume/EducationSelectors';
import { formatDateForResume, formatEducationYearRange, formatMonthRange } from '@/lib/resume-dates';
import { buildMasterResume, validateMasterResume } from '@/features/resume/build-master-resume';
import {
  loadResumeWizardDraft,
  saveResumeWizardDraft,
  clearResumeWizardDraft,
  peekResumeSeedFromProfile,
  peekResumeStartWizard,
  peekResumeAutofillSeed,
  peekResumeFromAutofill,
  peekResumeFromBuild,
  clearResumeAutofillSeed,
  clearResumeFromAutofill,
  clearResumeFromBuild,
  type ResumeWizardDraft,
} from '@/features/resume/resume-wizard-draft';
import {
  buildWizardSeedFromCandidate,
  mapCandidateProfileToResumeWizard,
  mergeProfileSeedWithDraft,
} from '@/features/resume/profile-to-resume-wizard';
import {
  getResumeUpdateResumeId,
  isResumeUpdateMode,
  clearResumeUpdateMode,
} from '@/features/resume/resume-update-mode';
import { validateWizardStep } from '@/features/resume/resume-wizard-validation';
import type { ResumeAiSuggestion } from '@/features/resume/resume-ai-review';
import { getStoredUser, patchStoredUser } from '@/lib/session';
import {
  getCandidateMe,
  getResume,
  listResumes,
  createResume,
  updateResume,
  savePassport,
  updateCandidateMe,
} from '@/lib/api';
import { masterResumeToResumeContent } from '@/features/resume/master-to-resume-content';
import { mapResumeContentToPassportPayload } from '@/features/resume/resume-content-to-passport';
import type { CandidateProfile } from '@careerbridge/shared';

type FlowPhase = 'choose' | 'wizard' | 'preview' | 'finish';

function formatSalaryDisplay(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('en-IN');
}
type ActiveForm = null | 'education' | 'experience' | 'project' | 'certification' | 'achievement';

interface EducationItem {
  id: string;
  degree: string;
  field: string;
  institution: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  grade: string;
  gradeType: string;
}

interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  responsibilities: string[];
}

interface ProjectItem {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
}

interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

interface AchievementItem {
  id: string;
  title: string;
  organization: string;
  description: string;
  date: string;
}

const WIZARD_STEPS = [
  'Personal',
  'Education',
  'Experience',
  'Skills',
  'Projects',
  'Certifications',
  'Languages',
  'Preferences',
  'Review',
];

const STEP_SECTION_LABELS: Record<string, string> = {
  Personal: 'Personal details',
  Education: 'Education details',
  Experience: 'Experience details',
  Skills: 'Skills section',
  Projects: 'Project details',
  Certifications: 'Certification details',
  Languages: 'Language details',
  Preferences: 'Job preference details',
  Review: 'Review details',
};

const REVIEW_INDEX = WIZARD_STEPS.length - 1;

function getStepSectionLabel(step: string) {
  return STEP_SECTION_LABELS[step] || step;
}

const LANGUAGE_POOL = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
];

function normalizeLanguagePool(selected: string[], available: string[] | undefined) {
  const selectedClean = (selected || []).filter(Boolean);
  const fromDraft = (available || []).filter((name) => name && !selectedClean.includes(name));
  if (fromDraft.length > 0) return { languages: selectedClean, availableLanguages: fromDraft };
  return {
    languages: selectedClean,
    availableLanguages: LANGUAGE_POOL.filter((name) => !selectedClean.includes(name)),
  };
}

function applyWizardDraft(draft: Omit<ResumeWizardDraft, 'savedAt'>) {
  const langs = normalizeLanguagePool(draft.languages, draft.availableLanguages);
  const phase =
    draft.flowPhase === 'preview' ||
    draft.flowPhase === 'choose' ||
    draft.flowPhase === 'wizard' ||
    draft.flowPhase === 'finish'
      ? draft.flowPhase
      : 'wizard';
  return {
    flowPhase: phase,
    wizardIndex: draft.wizardIndex,
    fullName: draft.fullName,
    location: draft.location,
    email: draft.email,
    phone: draft.phone,
    summary: draft.summary,
    skills: draft.skills,
    educationList: draft.educationList as EducationItem[],
    experienceList: draft.experienceList as ExperienceItem[],
    projectList: draft.projectList as ProjectItem[],
    certificationList: draft.certificationList as CertificationItem[],
    achievementList: draft.achievementList as AchievementItem[],
    languages: langs.languages,
    availableLanguages: langs.availableLanguages,
    preferredRole: draft.preferredRole,
    preferredLocation: draft.preferredLocation,
    expectedSalary: draft.expectedSalary,
  };
}

function applyProfileSeed(
  seed: Omit<ResumeWizardDraft, 'savedAt' | 'flowPhase' | 'wizardIndex'>,
  setters: {
    setFullName: (value: string) => void;
    setLocation: (value: string) => void;
    setEmail: (value: string) => void;
    setPhone: (value: string) => void;
    setSummary: (value: string) => void;
    setSkills: (value: string[]) => void;
    setEducationList: (value: EducationItem[]) => void;
    setExperienceList: (value: ExperienceItem[]) => void;
    setProjectList: (value: ProjectItem[]) => void;
    setCertificationList: (value: CertificationItem[]) => void;
    setAchievementList: (value: AchievementItem[]) => void;
    setLanguages: (value: string[]) => void;
    setAvailableLanguages: (value: string[]) => void;
    setPreferredRole: (value: string) => void;
    setPreferredLocation: (value: string) => void;
    setExpectedSalary: (value: string) => void;
  },
) {
  setters.setFullName(seed.fullName);
  setters.setLocation(seed.location);
  setters.setEmail(seed.email);
  setters.setPhone(seed.phone);
  setters.setSummary(seed.summary);
  setters.setSkills(seed.skills);
  setters.setEducationList(seed.educationList as EducationItem[]);
  setters.setExperienceList(seed.experienceList as ExperienceItem[]);
  setters.setProjectList(seed.projectList as ProjectItem[]);
  setters.setCertificationList(seed.certificationList as CertificationItem[]);
  setters.setAchievementList(seed.achievementList as AchievementItem[]);
  setters.setLanguages(seed.languages);
  setters.setAvailableLanguages(seed.availableLanguages);
  setters.setPreferredRole(seed.preferredRole);
  setters.setPreferredLocation(seed.preferredLocation);
  setters.setExpectedSalary(seed.expectedSalary);
}

export default function ResumePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#faf8f4] text-sm text-slate-500">
          Loading…
        </main>
      }
    >
      <ResumePageInner />
    </Suspense>
  );
}

function ResumePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromAutofillQuery = searchParams.get('from') === 'autofill';
  const fromBuildQuery = searchParams.get('from') === 'build';
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('wizard');
  const [wizardIndex, setWizardIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [summary, setSummary] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const [educationList, setEducationList] = useState<EducationItem[]>([]);
  const [experienceList, setExperienceList] = useState<ExperienceItem[]>([]);
  const [projectList, setProjectList] = useState<ProjectItem[]>([]);
  const [certificationList, setCertificationList] = useState<CertificationItem[]>([]);
  const [achievementList, setAchievementList] = useState<AchievementItem[]>([]);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [draftReady, setDraftReady] = useState(false);

  const [languages, setLanguages] = useState<string[]>([]);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([...LANGUAGE_POOL]);

  const [preferredRole, setPreferredRole] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [savedResumeId, setSavedResumeId] = useState<string | undefined>();
  const [highlightMissingPersonal, setHighlightMissingPersonal] = useState(false);
  const isBuildPath = fromBuildQuery || peekResumeFromBuild();
  const isAutofillPath =
    Boolean(fromAutofillQuery || peekResumeFromAutofill()) || highlightMissingPersonal;

  useEffect(() => {
    let active = true;

    async function init() {
      const updateMode = isResumeUpdateMode();
      const updateResumeId = updateMode ? getResumeUpdateResumeId() : undefined;

      function restoreFromDraft(source: Omit<ResumeWizardDraft, 'savedAt'>) {
        const restored = applyWizardDraft(source);
        setFlowPhase(restored.flowPhase);
        setWizardIndex(restored.wizardIndex);
        setFullName(restored.fullName);
        setLocation(restored.location);
        setEmail(restored.email);
        setPhone(restored.phone);
        setSummary(restored.summary);
        setSkills(restored.skills);
        setEducationList(restored.educationList);
        setExperienceList(restored.experienceList);
        setProjectList(restored.projectList);
        setCertificationList(restored.certificationList);
        setAchievementList(restored.achievementList);
        setLanguages(restored.languages);
        setAvailableLanguages(restored.availableLanguages);
        setPreferredRole(restored.preferredRole);
        setPreferredLocation(restored.preferredLocation);
        setExpectedSalary(restored.expectedSalary);
      }

      function applySeed(source: Omit<ResumeWizardDraft, 'savedAt' | 'flowPhase' | 'wizardIndex'>) {
        applyProfileSeed(source, {
          setFullName,
          setLocation,
          setEmail,
          setPhone,
          setSummary,
          setSkills,
          setEducationList,
          setExperienceList,
          setProjectList,
          setCertificationList,
          setAchievementList,
          setLanguages,
          setAvailableLanguages,
          setPreferredRole,
          setPreferredLocation,
          setExpectedSalary,
        });
      }

      // Path A: seed from uploaded resume → open Personal step (skip choose screen)
      const autofillSeed = peekResumeAutofillSeed();
      const fromAutofill = Boolean(autofillSeed || peekResumeFromAutofill() || fromAutofillQuery);
      if (fromAutofill) {
        if (autofillSeed) {
          const { resumeId, highlightMissing, ...seedFields } = autofillSeed;
          applySeed(seedFields);
          if (resumeId) setSavedResumeId(resumeId);
          setHighlightMissingPersonal(Boolean(highlightMissing ?? true));
          saveResumeWizardDraft({
            flowPhase: 'wizard',
            wizardIndex: 0,
            fullName: seedFields.fullName || '',
            location: seedFields.location || '',
            email: seedFields.email || '',
            phone: seedFields.phone || '',
            summary: seedFields.summary || '',
            skills: seedFields.skills || [],
            educationList: seedFields.educationList || [],
            experienceList: seedFields.experienceList || [],
            projectList: seedFields.projectList || [],
            certificationList: seedFields.certificationList || [],
            achievementList: seedFields.achievementList || [],
            languages: seedFields.languages || [],
            availableLanguages: seedFields.availableLanguages || [],
            preferredRole: seedFields.preferredRole || '',
            preferredLocation: seedFields.preferredLocation || '',
            expectedSalary: seedFields.expectedSalary || '',
          });
          // Clear seed only — keep from-autofill flag for Strict Mode remount.
          clearResumeAutofillSeed();
          setFlowPhase('wizard');
          setWizardIndex(0);
        } else {
          const draft = loadResumeWizardDraft();
          if (draft) {
            restoreFromDraft({
              ...draft,
              flowPhase: draft.flowPhase === 'choose' ? 'wizard' : draft.flowPhase,
            });
          } else {
            setFlowPhase('wizard');
            setWizardIndex(0);
          }
          setHighlightMissingPersonal(true);
        }
        if (active) setDraftReady(true);
        return;
      }

      if (updateMode) {
        try {
          const [profile, rows] = await Promise.all([getCandidateMe(), listResumes()]);
          if (!active) return;

          let record = updateResumeId
            ? rows.find((row) => row.id === updateResumeId) || null
            : rows.find((row) => row.kind !== 'OPTIMIZED') || rows[0] || null;

          if (updateResumeId && !record) {
            try {
              record = await getResume(updateResumeId);
            } catch {
              record = null;
            }
          }

          if (!profile) {
            if (active) setDraftReady(true);
            return;
          }

          const seeded = buildWizardSeedFromCandidate(profile, record, {
            flowPhase: 'wizard',
            wizardIndex: 0,
          });
          applySeed(seeded);
          if (record?.id) setSavedResumeId(record.id);
          setFlowPhase('wizard');
          setWizardIndex(0);
          clearResumeUpdateMode();
          if (active) setDraftReady(true);
          return;
        } catch {
          clearResumeUpdateMode();
          // Fall through to profile/draft path below.
        }
      }

      const seedFromProfile = peekResumeSeedFromProfile();
      const startWizard = peekResumeStartWizard() || fromBuildQuery || peekResumeFromBuild();
      if (seedFromProfile) clearResumeWizardDraft();
      const draft = seedFromProfile ? null : loadResumeWizardDraft();

      try {
        const profile = await getCandidateMe();
        if (!active) return;

        if (!profile) {
          if (draft) restoreFromDraft(draft);
          return;
        }

        if (seedFromProfile || !draft) {
          applySeed(mapCandidateProfileToResumeWizard(profile));
          setFlowPhase(startWizard ? 'wizard' : 'choose');
          setWizardIndex(0);
          setHighlightMissingPersonal(false);
          // Keep build/from-profile flags for Strict Mode remount; clear only ephemeral start flag after draft saves.
          if (typeof window !== 'undefined' && startWizard) {
            sessionStorage.removeItem('cb.resumeStartWizard');
            // Persist build flag until ATS / dashboard
            if (fromBuildQuery || peekResumeFromBuild()) {
              sessionStorage.setItem('cb.resumeFromBuild', '1');
            }
          } else if (typeof window !== 'undefined') {
            sessionStorage.removeItem('cb.resumeFromProfile');
            sessionStorage.removeItem('cb.resumeStartWizard');
          }
          return;
        }

        restoreFromDraft(mergeProfileSeedWithDraft(draft, profile));
      } catch {
        if (!active) return;
        if (draft) {
          restoreFromDraft(draft);
          return;
        }
        try {
          const user = getStoredUser();
          if (user?.firstName) {
            setFullName(user.firstName);
          }
        } catch {}
      } finally {
        if (active) setDraftReady(true);
      }

      try {
        const rows = await listResumes();
        if (!active) return;
        const primary = rows.find((row) => row.kind !== 'OPTIMIZED') || rows[0];
        if (primary?.id) {
          setSavedResumeId(primary.id);
        }
      } catch {
        // ignore
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [fromAutofillQuery, fromBuildQuery]);

  useEffect(() => {
    if (!draftReady) return;
    saveResumeWizardDraft({
      flowPhase,
      wizardIndex,
      fullName,
      location,
      email,
      phone,
      summary,
      skills,
      educationList,
      experienceList,
      projectList,
      certificationList,
      achievementList,
      languages,
      availableLanguages,
      preferredRole,
      preferredLocation,
      expectedSalary,
    });
  }, [
    draftReady,
    flowPhase,
    wizardIndex,
    fullName,
    location,
    email,
    phone,
    summary,
    skills,
    educationList,
    experienceList,
    projectList,
    certificationList,
    achievementList,
    languages,
    availableLanguages,
    preferredRole,
    preferredLocation,
    expectedSalary,
  ]);

  const masterResume = useMemo(
    () =>
      buildMasterResume({
        fullName,
        location,
        email,
        phone,
        summary,
        skills,
        experienceList,
        educationList,
        projectList,
        certificationList,
        achievementList,
      }),
    [
      fullName,
      location,
      email,
      phone,
      summary,
      skills,
      experienceList,
      educationList,
      projectList,
      certificationList,
      achievementList,
    ],
  );

  const currentStep = WIZARD_STEPS[wizardIndex];
  const isReviewStep = wizardIndex === REVIEW_INDEX;

  function addSkill(s: string) {
    const trimmed = s.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
  }

  function removeSkill(s: string) {
    setSkills((prev) => prev.filter((x) => x !== s));
  }

  function addLanguage(l: string) {
    if (!languages.includes(l)) {
      setLanguages((prev) => [...prev, l]);
      setAvailableLanguages((prev) => prev.filter((x) => x !== l));
    }
  }

  function removeLanguage(l: string) {
    setLanguages((prev) => prev.filter((x) => x !== l));
    if (!availableLanguages.includes(l)) {
      setAvailableLanguages((prev) => [...prev, l]);
    }
  }

  async function handleFinishWizard() {
    const errors = validateMasterResume(masterResume);
    if (errors.length) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSaving(true);
    try {
      await ensureResumeSaved();
      try {
        const content = masterResumeToResumeContent(masterResume);
        const profile = await savePassport(mapResumeContentToPassportPayload(content));
        const preferredLanguage = languages[0]?.trim();
        if (preferredLanguage) {
          await updateCandidateMe({ preferredLanguage }).catch(() => undefined);
        }
        patchStoredUser({ firstName: profile.firstName, onboardingCompleted: true });
      } catch {
        // Resume is saved; passport sync can be completed later from dashboard.
      }
      setFlowPhase('finish');
      clearResumeFromAutofill();
      // Keep build path flag so the next-step screen can show Path B guidance.
    } catch {
      setValidationErrors(['Could not save your resume. Please try again.']);
    } finally {
      setSaving(false);
    }
  }

  function handleSaveAndContinue() {
    const errors = validateMasterResume(masterResume);
    if (errors.length) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSaving(true);
    setFlowPhase('preview');
    setSaving(false);
  }

  function handleWizardNext() {
    const errors = validateWizardStep(currentStep, {
      fullName,
      location,
      email,
      phone,
      skills,
      educationList,
      languages,
      preferredRole,
    });
    if (errors.length) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    if (wizardIndex < REVIEW_INDEX) {
      setWizardIndex((prev) => prev + 1);
    }
  }

  async function ensureResumeSaved(): Promise<string> {
    const content = masterResumeToResumeContent(masterResume);
    const title = `${fullName.trim() || 'My'} Resume`;
    const payload = {
      title,
      targetJobTitle: preferredRole.trim() || undefined,
      template: 'resume-template-01',
      summary: summary || content.summary || undefined,
      content: content as unknown as Record<string, unknown>,
    };

    if (savedResumeId) {
      const updated = await updateResume(savedResumeId, payload);
      setSavedResumeId(updated.id);
      return updated.id;
    }

    const created = await createResume({
      ...payload,
      content: content as unknown as Record<string, unknown>,
    });
    setSavedResumeId(created.id);
    return created.id;
  }

  function handleApplyAiSuggestion(suggestion: ResumeAiSuggestion, improvedText: string) {
    const lines = improvedText
      .split(/\n+/)
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean);

    switch (suggestion.section) {
      case 'summary':
        setSummary(improvedText.replace(/\n+/g, ' ').trim());
        break;
      case 'skills':
        setSkills(
          improvedText
            .split(',')
            .map((skill) => skill.trim())
            .filter(Boolean),
        );
        break;
      case 'experience':
        setExperienceList((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          next[0] = { ...next[0], responsibilities: lines };
          return next;
        });
        break;
      case 'projects':
        setProjectList((prev) => {
          if (!prev.length) return prev;
          const next = [...prev];
          next[0] = {
            ...next[0],
            description: lines[0] || improvedText,
            bullets: lines.length > 1 ? lines.slice(1) : lines,
          };
          return next;
        });
        break;
      case 'education':
        setEducationList((prev) => {
          if (!prev.length) {
            return [
              {
                id: `edu-${Date.now()}`,
                degree: improvedText.split(' in ')[0] || improvedText,
                field: improvedText.includes(' in ')
                  ? improvedText.split(' in ')[1]?.split(' — ')[0] || ''
                  : '',
                institution: improvedText.split(' — ')[1]?.replace(/\s*\(.*\)$/, '') || '',
                location: '',
                startDate: '',
                endDate: '',
                isCurrent: false,
                grade: '',
                gradeType: '',
              },
            ];
          }
          const next = [...prev];
          const degreeMatch = improvedText.match(/^([^—]+?)(?:\s+in\s+([^—]+))?/);
          next[0] = {
            ...next[0],
            degree: degreeMatch?.[1]?.trim() || next[0].degree,
            field: degreeMatch?.[2]?.trim() || next[0].field,
            institution: improvedText.split(' — ')[1]?.replace(/\s*\(.*\)$/, '').trim() || next[0].institution,
          };
          return next;
        });
        break;
      case 'achievements': {
        const achievementEntries: AchievementItem[] = [];
        const certEntries: CertificationItem[] = [];

        for (const line of lines) {
          if (/certification|certificate|certified/i.test(line)) {
            const name = line.replace(/\s*—\s*Udemy\s*$/i, '').trim() || line;
            certEntries.push({
              id: `cert-${Date.now()}-${certEntries.length}`,
              name,
              issuer: /udemy/i.test(line) ? 'Udemy' : '',
              date: '',
            });
          } else {
            achievementEntries.push({
              id: `ach-${Date.now()}-${achievementEntries.length}`,
              title: line,
              organization: '',
              description: '',
              date: '',
            });
          }
        }

        setAchievementList(achievementEntries);
        setCertificationList(certEntries);
        break;
      }
      case 'contact': {
        const parts = improvedText.split('|').map((part) => part.trim());
        if (parts[0] && !fullName) setFullName(parts[0]);
        const emailPart = parts.find((part) => part.includes('@'));
        const phonePart = parts.find((part) => /\+?\d/.test(part));
        if (emailPart) setEmail(emailPart);
        if (phonePart) setPhone(phonePart);
        break;
      }
      default:
        break;
    }
  }

  async function goToDashboard() {
    clearResumeFromAutofill();
    clearResumeFromBuild();
    clearResumeWizardDraft();
    try {
      const content = masterResumeToResumeContent(masterResume);
      await savePassport(mapResumeContentToPassportPayload(content));
    } catch {
      /* still mark dashboard reached */
    }
    try {
      await updateCandidateMe({ dashboardReached: true, onboardingCompleted: true });
      patchStoredUser({ dashboardReached: true, onboardingCompleted: true });
    } catch {
      patchStoredUser({ dashboardReached: true, onboardingCompleted: true });
    }
    router.push('/dashboard');
  }

  async function syncProfileFromResume() {
    const content = masterResumeToResumeContent(masterResume);
    const profile = await savePassport(mapResumeContentToPassportPayload(content));
    const preferredLanguage = languages[0]?.trim();
    if (preferredLanguage) {
      await updateCandidateMe({ preferredLanguage }).catch(() => undefined);
    }
    try {
      await updateCandidateMe({ dashboardReached: true, onboardingCompleted: true });
    } catch {
      /* optional */
    }
    patchStoredUser({
      firstName: profile.firstName,
      onboardingCompleted: true,
      dashboardReached: true,
    });
  }

  function handleBack() {
    setValidationErrors([]);
    if (flowPhase === 'finish') {
      setFlowPhase('wizard');
      setWizardIndex(REVIEW_INDEX);
      return;
    }
    if (flowPhase === 'preview') {
      setFlowPhase('wizard');
      setWizardIndex(REVIEW_INDEX);
      return;
    }
    if (flowPhase === 'choose') {
      router.push('/dashboard');
      return;
    }
    if (wizardIndex > 0) {
      setWizardIndex((prev) => prev - 1);
      return;
    }
    if (highlightMissingPersonal) {
      clearResumeFromAutofill();
      router.push('/onboarding/complete');
      return;
    }
    setFlowPhase('choose');
  }

  if (!draftReady) {
    return (
      <div className="cb-resume-flow-root flex min-h-screen items-center justify-center bg-[#f3f4ee]">
        <p className="text-sm font-medium text-[#43526b]">Loading your resume…</p>
      </div>
    );
  }

  return (
    <div className={`cb-resume-flow-root${flowPhase === 'preview' ? ' cb-resume-flow-preview' : ''}`}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        :root {
          --ink: #142a4f;
          --ink-70: #43526b;
          --ink-50: #6b7789;
          --paper: #f3f4ee;
          --card: #ffffff;
          --line: #dde0d3;
          --marigold: #e29a34;
          --marigold-dark: #b67a22;
          --teal: #2e7d63;
          --radius-m: 10px;
          --radius-l: 16px;
        }

        .cb-resume-flow-root {
          font-family: 'Inter', sans-serif;
          background: var(--paper);
          color: var(--ink);
          min-height: 100vh;
        }

        .cb-flow-topbar {
          max-width: 900px;
          margin: 0 auto;
          padding: 14px 20px 0;
          display: flex;
          justify-content: flex-end;
        }
        .cb-flow-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 0;
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: var(--ink);
          cursor: pointer;
        }
        .cb-flow-back-btn:hover { color: var(--ink-70); }

        .cb-main-head-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }
        .cb-main-head-row h1 {
          flex: 1;
          min-width: 0;
        }
        .cb-main-head-row .cb-flow-back-btn {
          flex-shrink: 0;
          padding-top: 4px;
        }

        .cb-wizard-shell {
          max-width: 900px;
          margin: 0 auto;
          padding: 32px 20px 60px;
        }

        @media (max-width: 768px) {
          .cb-flow-topbar { padding: 12px 12px 0; }
          .cb-wizard-shell { padding: 16px 12px 32px; }
          .cb-field-grid { grid-template-columns: 1fr !important; }
          .cb-main-head { margin-bottom: 12px; }
          .cb-main-head h1 { font-size: 20px; }
          .cb-main-head .desc { font-size: 12.5px; }
          .cb-section-head { font-size: 16px; margin-bottom: 14px; }
          .cb-stepper-wrap { margin-bottom: 16px; }
          .cb-stepper-desktop { display: none !important; }
          .cb-resume-flow-preview {
            display: flex;
            flex-direction: column;
            min-height: 100dvh;
            height: 100dvh;
            background: #fff;
            overflow: hidden;
          }
          .cb-resume-flow-preview .cb-preview-page {
            flex: 1 1 auto;
            min-height: 0;
          }
        }

        .cb-main-head { margin-bottom: 26px; }
        .cb-main-head h1 {
          font-size: 24px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          color: var(--ink);
          margin: 0;
        }
        .cb-main-head .desc {
          font-size: 13.5px;
          color: var(--ink-70);
          margin-top: 4px;
        }

        .cb-validation-errors {
          background: #fcebea;
          border: 1px solid #e8b4b0;
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 13px;
          color: #8b2e26;
        }
        .cb-validation-errors div + div { margin-top: 4px; }

        .cb-section-head {
          text-align: center;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--ink);
          margin: 0 0 18px;
        }

        .cb-stepper-wrap {
          margin-bottom: 28px;
        }
        .cb-stepper-row {
          display: flex;
          gap: 4px;
          width: 100%;
        }
        .cb-stepper-desktop .cb-step-h .lab {
          font-size: 11px;
        }
        .cb-step-h {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 7px;
          cursor: pointer;
        }
        .cb-step-h .track {
          height: 3px;
          border-radius: 2px;
          background: var(--line);
        }
        .cb-step-h .track.done { background: var(--teal); }
        .cb-step-h .track.current { background: var(--marigold); }
        .cb-step-h .lab {
          font-size: 12px;
          color: var(--ink-50);
          text-align: center;
          line-height: 1.2;
          white-space: nowrap;
        }
        .cb-step-h .lab.current { color: var(--ink); font-weight: 700; }

        .cb-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          border-radius: var(--radius-m);
          padding: 11px 20px;
          border: none;
          cursor: pointer;
        }
        .cb-btn-primary { background: var(--ink); color: #fff; }
        .cb-btn-primary:hover { background: #0f203d; }
        .cb-btn-ghost {
          background: transparent;
          color: var(--ink);
          border: 1.5px solid var(--line);
        }
        .cb-btn-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .cb-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius-l);
          padding: 26px 28px;
          margin-bottom: 20px;
        }

        .cb-field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .cb-field { margin-bottom: 16px; }
        .cb-field.full { grid-column: 1 / -1; }
        .cb-field label {
          display: block;
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-70);
          margin-bottom: 6px;
        }
        .cb-field input,
        .cb-field textarea {
          width: 100%;
          border: 1.5px solid var(--line);
          border-radius: var(--radius-m);
          padding: 11px 13px;
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: var(--ink);
          resize: none;
          box-sizing: border-box;
        }
        .cb-field textarea { min-height: 78px; }
        .cb-field input:focus,
        .cb-field textarea:focus {
          outline: 2px solid var(--marigold);
          outline-offset: 1px;
          border-color: transparent;
        }

        .cb-search-field {
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1.5px solid var(--line);
          border-radius: var(--radius-m);
          padding: 12px 15px;
          margin-bottom: 8px;
        }
        .cb-section-label {
          font-size: 12.5px;
          font-weight: 600;
          color: var(--ink-50);
          margin: 22px 0 12px;
        }
        .cb-chip-wrap { display: flex; flex-wrap: wrap; gap: 9px; }
        .cb-chip {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          font-size: 13.5px;
          font-weight: 600;
          padding: 9px 15px;
          cursor: pointer;
          border: 1.5px solid #0d9488;
          background: #f0fdfa;
          color: #0f766e;
        }
        .cb-chip .plus { color: #0d9488; font-weight: 800; }
        .cb-chip.selected {
          background: var(--ink);
          border-color: var(--ink);
          color: #fff;
        }

        .cb-add-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1.5px dashed var(--line);
          border-radius: var(--radius-m);
          padding: 14px;
          color: var(--ink-70);
          font-size: 13.5px;
          font-weight: 600;
          cursor: pointer;
          margin-bottom: 12px;
          width: 100%;
          background: transparent;
          font-family: 'Inter', sans-serif;
        }
        .cb-entry-card {
          border: 1px solid var(--line);
          border-radius: var(--radius-m);
          padding: 14px 16px;
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .cb-entry-card .role { font-size: 14px; font-weight: 700; }
        .cb-entry-card .meta { font-size: 12.5px; color: var(--ink-50); margin-top: 2px; }
        .cb-entry-card .edit-link,
        .cb-entry-card .remove {
          font-size: 12.5px;
          color: var(--ink-50);
          font-weight: 600;
          cursor: pointer;
          background: none;
          border: none;
          font-family: 'Inter', sans-serif;
        }

        /* Review screen (combined form) */
        .cb-review-shell { max-width: 640px; margin: 0 auto; }
        .cb-review-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 24px;
        }
        .cb-review-card {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: var(--radius-l);
          padding: 28px;
        }
        .cb-review-section { margin-bottom: 28px; }
        .cb-review-section:last-of-type { margin-bottom: 0; }
        .cb-review-section-title {
          font-size: 15px;
          font-weight: 700;
          margin: 0 0 16px;
        }
        .cb-save-btn {
          display: block;
          width: auto;
          min-width: 200px;
          margin: 32px auto 0;
          padding: 14px 32px;
          background: var(--ink);
          color: #fff;
          border: none;
          border-radius: var(--radius-m);
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .cb-entry-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-shrink: 0;
        }
        .cb-entry-actions .edit {
          border: 1.5px solid #dde0d3;
          background: #fff;
          color: #142a4f;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }
        .cb-entry-actions .remove {
          cursor: pointer;
        }
          `,
        }}
      />

      {flowPhase === 'finish' ? (
        <div className="cb-wizard-shell">
          <div className="mx-auto max-w-xl px-4 py-10">
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a2e2c]/10 text-[#0a2e2c]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 12.5l2 2 4.5-4.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
              <h1 className="mt-4 text-center text-2xl font-extrabold text-slate-900">
                {isBuildPath ? 'Resume built' : 'Resume ready'}
              </h1>
              <p className="mt-2 text-center text-sm text-slate-600">
                {isBuildPath
                  ? 'Next: check ATS score, improve with AI, then download and save. Your profile updates when you save.'
                  : 'Your resume is saved and your profile is updated. What would you like to do next?'}
              </p>

              {isBuildPath ? (
                <ol className="mt-5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <li className="font-semibold text-emerald-800">1. Build resume — done</li>
                  <li className="font-semibold text-slate-900">2. Check ATS score — next</li>
                  <li>3. Improve with AI (accept or reject each suggestion)</li>
                  <li>4. Download &amp; save (cloud + profile)</li>
                  <li>5. Candidate Dashboard</li>
                </ol>
              ) : null}

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    clearResumeFromAutofill();
                    setFlowPhase('preview');
                  }}
                  className="rounded-2xl border-2 border-[#0a2e2c] bg-[#0a2e2c] p-5 text-left text-white transition hover:bg-[#072422] sm:col-span-2"
                >
                  <p className="text-base font-extrabold">Check ATS score</p>
                  <p className="mt-1.5 text-sm text-white/75">
                    See how ATS-ready your resume is, then Improve with AI, download, and save.
                  </p>
                  <span className="mt-4 inline-block text-sm font-bold text-[#e68a39]">
                    Continue →
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearResumeFromBuild();
                    clearResumeFromAutofill();
                    void goToDashboard();
                  }}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-left transition hover:border-[#0a2e2c]/40 hover:bg-white sm:col-span-2"
                >
                  <p className="text-base font-extrabold text-slate-900">Candidate Dashboard</p>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Skip ATS for now and go to your dashboard.
                  </p>
                  <span className="mt-4 inline-block text-sm font-bold text-[#0a2e2c]">
                    Open dashboard →
                  </span>
                </button>
              </div>
              <button
                type="button"
                className="cb-flow-back-btn mt-6 w-full"
                onClick={handleBack}
              >
                ← Back to review
              </button>
            </div>
          </div>
        </div>
      ) : flowPhase === 'preview' ? (
          <ResumePreviewScreen
            resume={masterResume}
            targetJobTitle={preferredRole}
            resumeId={savedResumeId}
            resumeFileName={`${fullName.trim() || 'My'} Resume`}
            onEnsureSaved={ensureResumeSaved}
            onResumeSaved={(id) => {
              setSavedResumeId(id);
            }}
            onSyncProfile={syncProfileFromResume}
            onBack={handleBack}
            onEdit={() => {
              setFlowPhase('wizard');
              setWizardIndex(REVIEW_INDEX);
            }}
            onAddSection={(sectionLabel) => {
              const key = sectionLabel.toLowerCase();
              let step = 'Personal';
              if (key.includes('educat')) step = 'Education';
              else if (key.includes('experience') || key.includes('work')) step = 'Experience';
              else if (key.includes('skill')) step = 'Skills';
              else if (key.includes('project')) step = 'Projects';
              else if (key.includes('cert') || key.includes('achiev')) step = 'Certifications';
              else if (key.includes('summary') || key.includes('contact')) step = 'Personal';
              setFlowPhase('wizard');
              setWizardIndex(Math.max(0, WIZARD_STEPS.indexOf(step)));
            }}
            onApplySuggestion={handleApplyAiSuggestion}
          />
      ) : flowPhase === 'choose' ? (
        <div className="cb-wizard-shell">
          <div className="mx-auto max-w-xl">
            <div className="flex justify-end">
              <button type="button" className="cb-flow-back-btn" onClick={() => router.push('/dashboard')}>
                ← Back
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a2e2c]/10 text-[#0a2e2c]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M9 12.5l2 2 4.5-4.5"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>

              <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-slate-900">
                Create your resume
              </h1>
              <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
                Your profile is ready. Choose how you want to add a resume — you can change this later.
              </p>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-full rounded-full bg-[#e68a39]" />
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => router.push('/resume/upload')}
                  className="group flex cursor-pointer flex-col items-start rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition hover:border-[#0a2e2c]/40 hover:bg-white hover:shadow-md"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-[#0a2e2c] shadow-sm ring-1 ring-slate-200 transition group-hover:ring-[#0a2e2c]/30">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M12 16V7m0 0l-3.5 3.5M12 7l3.5 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 17.5V19a2 2 0 002 2h10a2 2 0 002-2v-1.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <p className="mt-4 text-base font-extrabold text-slate-900">Upload resume</p>
                  <p className="mt-1.5 text-sm leading-snug text-slate-600">
                    Already have a PDF or Word file? Upload it and we&apos;ll extract your details.
                  </p>
                  <span className="mt-4 text-sm font-bold text-[#0a2e2c]">Upload file →</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      sessionStorage.setItem('cb.resumeFromBuild', '1');
                    }
                    setFlowPhase('wizard');
                    setWizardIndex(0);
                  }}
                  className="group flex cursor-pointer flex-col items-start rounded-2xl border-2 border-[#0a2e2c] bg-[#0a2e2c] p-5 text-left text-white shadow-sm transition hover:bg-[#072422]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-white">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M7 4h7l4 4v12a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path d="M14 4v4h4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path
                        d="M8.5 13h7M8.5 16.5h5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <p className="mt-4 text-base font-extrabold">Build from Scratch</p>
                  <p className="mt-1.5 text-sm leading-snug text-white/75">
                    Guided wizard → ATS score → Improve with AI → download &amp; save.
                  </p>
                  <span className="mt-4 text-sm font-bold text-[#e68a39]">Start building →</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="mt-6 w-full cursor-pointer rounded-xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              >
                Skip for now — go to Dashboard
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className="cb-wizard-shell">
        <div className="cb-main-head">
          <div className="cb-main-head-row">
            <h1>
              {isAutofillPath ? 'Complete your Profile' : 'Build your resume'}
            </h1>
            <button type="button" className="cb-flow-back-btn" onClick={handleBack}>
              Back ←
            </button>
          </div>
          <div className="desc">
            {isAutofillPath
              ? 'Fill in the gaps so your profile is ready.'
              : isBuildPath
                ? 'Fill each section, then check ATS score and improve with AI before you save.'
                : 'One strong profile — ready for every application.'}
          </div>
        </div>

        {!isReviewStep && (
          <div className="cb-stepper-wrap cb-stepper-desktop">
            <div className="cb-stepper-row">
              {WIZARD_STEPS.map((label, i) => (
                <div
                  key={label}
                  className="cb-step-h"
                  onClick={() => {
                    setValidationErrors([]);
                    setWizardIndex(i);
                  }}
                >
                  <div
                    className={`track ${
                      i < wizardIndex ? 'done' : i === wizardIndex ? 'current' : ''
                    }`}
                  />
                  <div className={`lab ${i === wizardIndex ? 'current' : ''}`}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WIZARD STEPS (before Review) */}
        {!isReviewStep && (
          <>
            <h2 className="cb-section-head">{getStepSectionLabel(currentStep)}</h2>
            {validationErrors.length > 0 && (
              <div className="cb-validation-errors">
                {validationErrors.map((err) => (
                  <div key={err}>{err}</div>
                ))}
              </div>
            )}
            <div className="cb-card">
              {currentStep === 'Personal' && (
                <div className="cb-field-grid">
                  {highlightMissingPersonal ? (
                    <p className="cb-field full" style={{ margin: 0, fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
                      Empty fields are highlighted in red — fill them to complete your profile.
                    </p>
                  ) : null}
                  <div className={`cb-field${highlightMissingPersonal && !fullName.trim() ? ' cb-field-missing' : ''}`}>
                    <label>Full name</label>
                    <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div className="cb-field full cb-location-pair">
                    <StateCitySelect
                      location={location}
                      onChange={setLocation}
                      stateLabel="State"
                      cityLabel="City"
                      highlightMissing={highlightMissingPersonal}
                    />
                  </div>
                  <div className={`cb-field${highlightMissingPersonal && !email.trim() ? ' cb-field-missing' : ''}`}>
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className={`cb-field${highlightMissingPersonal && !phone.trim() ? ' cb-field-missing' : ''}`}>
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div className={`cb-field full${highlightMissingPersonal && !summary.trim() ? ' cb-field-missing' : ''}`}>
                    <label>Professional summary</label>
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="A line or two about the role you want"
                    />
                  </div>
                </div>
              )}

              {currentStep === 'Education' && (
                <div>
                  {educationList.map((edu) => (
                    <div key={edu.id} className="cb-entry-card">
                      <div>
                        <div className="role">
                          {edu.degree}
                          {edu.field ? ` in ${edu.field}` : ''}
                        </div>
                        <div className="meta">
                          {[edu.institution, edu.location, formatEducationYearRange(edu.startDate, edu.isCurrent ? '' : edu.endDate)].filter(Boolean).join(' · ')}
                          {edu.grade ? ` · ${edu.gradeType || 'Grade'}: ${edu.grade}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setEducationList((prev) => prev.filter((x) => x.id !== edu.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {activeForm === 'education' ? (
                    <EducationInlineForm
                      onCancel={() => setActiveForm(null)}
                      onSave={(data) => {
                        setEducationList((prev) => [
                          ...prev,
                          {
                            id: `edu-${Date.now()}`,
                            degree: data.degree,
                            field: data.field,
                            institution: data.institution,
                            location: data.location,
                            startDate: data.startDate,
                            endDate: data.endDate,
                            isCurrent: data.isCurrent,
                            grade: data.grade,
                            gradeType: data.gradeType,
                          },
                        ]);
                        setActiveForm(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="cb-add-row" onClick={() => setActiveForm('education')}>
                      + Add education
                    </button>
                  )}
                </div>
              )}

              {currentStep === 'Experience' && (
                <div>
                  {experienceList.map((exp) => (
                    <div key={exp.id} className="cb-entry-card">
                      <div>
                        <div className="role">
                          {exp.role} — {exp.company}
                        </div>
                        <div className="meta">
                          {[formatMonthRange(exp.startDate, exp.endDate, exp.isCurrent), exp.location].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setExperienceList((prev) => prev.filter((x) => x.id !== exp.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {activeForm === 'experience' ? (
                    <ExperienceInlineForm
                      defaultLocation={location}
                      onCancel={() => setActiveForm(null)}
                      onSave={(data) => {
                        setExperienceList((prev) => [
                          ...prev,
                          {
                            id: `exp-${Date.now()}`,
                            role: data.role,
                            company: data.company,
                            location: data.location,
                            startDate: data.startDate,
                            endDate: data.endDate,
                            isCurrent: data.isCurrent,
                            responsibilities: data.responsibilities,
                          },
                        ]);
                        setActiveForm(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="cb-add-row" onClick={() => setActiveForm('experience')}>
                      + Add experience
                    </button>
                  )}
                </div>
              )}

              {currentStep === 'Projects' && (
                <div>
                  {projectList.map((proj) => (
                    <div key={proj.id} className="cb-entry-card">
                      <div>
                        <div className="role">{proj.name}</div>
                        <div className="meta">
                          {[proj.technologies.join(', '), proj.description].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setProjectList((prev) => prev.filter((x) => x.id !== proj.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {activeForm === 'project' ? (
                    <ProjectInlineForm
                      onCancel={() => setActiveForm(null)}
                      onSave={(data) => {
                        setProjectList((prev) => [
                          ...prev,
                          {
                            id: `proj-${Date.now()}`,
                            name: data.name,
                            description: data.description,
                            technologies: data.technologies,
                            bullets: data.bullets,
                          },
                        ]);
                        setActiveForm(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="cb-add-row" onClick={() => setActiveForm('project')}>
                      + Add project
                    </button>
                  )}
                </div>
              )}

              {currentStep === 'Certifications' && (
                <div>
                  {certificationList.map((cert) => (
                    <div key={cert.id} className="cb-entry-card">
                      <div>
                        <div className="role">{cert.name}</div>
                        <div className="meta">
                          {[cert.issuer, formatDateForResume(cert.date)].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setCertificationList((prev) => prev.filter((x) => x.id !== cert.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {activeForm === 'certification' ? (
                    <CertificationInlineForm
                      onCancel={() => setActiveForm(null)}
                      onSave={(data) => {
                        setCertificationList((prev) => [
                          ...prev,
                          { id: `cert-${Date.now()}`, name: data.name, issuer: data.issuer, date: data.date },
                        ]);
                        setActiveForm(null);
                      }}
                    />
                  ) : (
                    <button type="button" className="cb-add-row" onClick={() => setActiveForm('certification')}>
                      + Add certification
                    </button>
                  )}
                </div>
              )}

              {currentStep === 'Skills' && (
                <div>
                  <SkillSearchCombobox
                    label="Search and add your skills"
                    selected={skills}
                    onAdd={addSkill}
                    onRemove={removeSkill}
                    placeholder="Search technologies (e.g. React, Python) or type your own"
                  />
                </div>
              )}

              {currentStep === 'Languages' && (
                <div>
                  <p className="cb-section-label" style={{ marginTop: 0 }}>
                    Languages you speak
                  </p>
                  <p className="mb-3 text-sm text-[#5b6b7c]">
                    Tap a language to select it. Selected languages appear dark — tap again to remove.
                  </p>
                  <div className="cb-chip-wrap">
                    {Array.from(
                      new Set(
                        languages.length || availableLanguages.length
                          ? [...languages, ...availableLanguages]
                          : LANGUAGE_POOL,
                      ),
                    ).map((l) => {
                      const selected = languages.includes(l);
                      return (
                        <button
                          key={l}
                          type="button"
                          className={`cb-chip${selected ? ' selected' : ''}`}
                          onClick={() => (selected ? removeLanguage(l) : addLanguage(l))}
                        >
                          {l} <span className={selected ? undefined : 'plus'}>{selected ? '×' : '+'}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {currentStep === 'Preferences' && (
                <div className="cb-field-grid">
                  <div className="cb-field">
                    <label>Preferred role</label>
                    <input value={preferredRole} onChange={(e) => setPreferredRole(e.target.value)} />
                  </div>
                  <div className="cb-field">
                    <label>Preferred location</label>
                    <input
                      value={preferredLocation}
                      onChange={(e) => setPreferredLocation(e.target.value)}
                    />
                  </div>
                  <div className="cb-field full">
                    <label>Expected monthly salary</label>
                    <input
                      inputMode="numeric"
                      placeholder="50,000"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(formatSalaryDisplay(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="cb-btn-row">
              <button className="cb-btn cb-btn-primary" onClick={handleWizardNext}>
                Save &amp; continue
              </button>
            </div>
          </>
        )}

        {/* REVIEW SCREEN — opens after wizard when user reaches Review step */}
        {isReviewStep && (
          <>
            <h2 className="cb-section-head">{getStepSectionLabel(currentStep)}</h2>
            <div className="cb-review-shell">
            <div className="cb-review-card">
              {/* 1. Name */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Name</h2>
                <div className="cb-field">
                  <input
                    id="review-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
              </section>

              {/* Location collected once in Personal step */}
              {location ? (
                <section className="cb-review-section">
                  <h2 className="cb-review-section-title">Location</h2>
                  <p className="text-sm text-[#43526b]">{location}</p>
                  <button
                    type="button"
                    className="mt-1 text-xs font-semibold text-[#2e7d63] underline"
                    onClick={() => setWizardIndex(0)}
                  >
                    Edit in Personal details
                  </button>
                </section>
              ) : null}

              {/* Contact */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Contact</h2>
                <div className="cb-field-grid">
                  <div className="cb-field">
                    <label>Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div className="cb-field">
                    <label>Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>
              </section>

              {/* 3. Professional Summary */}
              <section className="cb-review-section">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="cb-review-section-title">Professional Summary</h2>
                  <div className="cb-entry-actions">
                    <button
                      type="button"
                      className="edit"
                      onClick={() => setWizardIndex(WIZARD_STEPS.indexOf('Personal'))}
                    >
                      Edit
                    </button>
                    <button type="button" className="remove" onClick={() => setSummary('')}>
                      Remove
                    </button>
                  </div>
                </div>
                <div className="cb-field">
                  <textarea
                    id="review-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="A short summary about your experience and goals"
                  />
                </div>
              </section>

              {/* 4. Skills */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Professional Skills</h2>
                <SkillSearchCombobox
                  selected={skills}
                  onAdd={addSkill}
                  onRemove={removeSkill}
                  placeholder="Search technologies or type your own skill"
                />
              </section>

              {/* 5. Work Experience */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Work Experience</h2>
                {experienceList.map((exp) => (
                  <div key={exp.id} className="cb-entry-card">
                    <div>
                      <div className="role">
                        {exp.role} — {exp.company}
                      </div>
                      <div className="meta">
                        {[formatMonthRange(exp.startDate, exp.endDate, exp.isCurrent), exp.location].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="cb-entry-actions">
                      <button
                        type="button"
                        className="edit"
                        onClick={() => {
                          setWizardIndex(WIZARD_STEPS.indexOf('Experience'));
                          setActiveForm(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setExperienceList((prev) => prev.filter((x) => x.id !== exp.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {activeForm === 'experience' ? (
                  <ExperienceInlineForm
                    defaultLocation={location}
                    onCancel={() => setActiveForm(null)}
                    onSave={(data) => {
                      setExperienceList((prev) => [
                        ...prev,
                        {
                          id: `exp-${Date.now()}`,
                          role: data.role,
                          company: data.company,
                          startDate: data.startDate,
                          endDate: data.endDate,
                          isCurrent: data.isCurrent,
                          location: data.location,
                          responsibilities: data.responsibilities,
                        },
                      ]);
                      setActiveForm(null);
                    }}
                  />
                ) : (
                  <button type="button" className="cb-add-row" onClick={() => setActiveForm('experience')}>
                    + Add Experience
                  </button>
                )}
              </section>

              {/* 6. Projects */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Projects</h2>
                {projectList.map((proj) => (
                  <div key={proj.id} className="cb-entry-card">
                    <div>
                      <div className="role">{proj.name}</div>
                      <div className="meta">
                        {[proj.technologies, proj.description].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="cb-entry-actions">
                      <button
                        type="button"
                        className="edit"
                        onClick={() => {
                          setWizardIndex(WIZARD_STEPS.indexOf('Projects'));
                          setActiveForm(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setProjectList((prev) => prev.filter((x) => x.id !== proj.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {activeForm === 'project' ? (
                  <ProjectInlineForm
                    onCancel={() => setActiveForm(null)}
                    onSave={(data) => {
                      setProjectList((prev) => [
                        ...prev,
                        {
                          id: `proj-${Date.now()}`,
                          name: data.name,
                          description: data.description,
                          technologies: data.technologies,
                          bullets: data.bullets,
                        },
                      ]);
                      setActiveForm(null);
                    }}
                  />
                ) : (
                  <button type="button" className="cb-add-row" onClick={() => setActiveForm('project')}>
                    + Add Project
                  </button>
                )}
              </section>

              {/* 7. Education */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Education</h2>
                {educationList.map((edu) => (
                  <div key={edu.id} className="cb-entry-card">
                    <div>
                      <div className="role">
                        {edu.degree}
                        {edu.field ? ` in ${edu.field}` : ''}
                      </div>
                      <div className="meta">
                        {[edu.institution, edu.location, formatEducationYearRange(edu.startDate, edu.isCurrent ? '' : edu.endDate)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="cb-entry-actions">
                      <button
                        type="button"
                        className="edit"
                        onClick={() => {
                          setWizardIndex(WIZARD_STEPS.indexOf('Education'));
                          setActiveForm(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setEducationList((prev) => prev.filter((x) => x.id !== edu.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {activeForm === 'education' ? (
                  <EducationInlineForm
                    onCancel={() => setActiveForm(null)}
                    onSave={(data) => {
                      setEducationList((prev) => [
                        ...prev,
                        {
                          id: `edu-${Date.now()}`,
                          degree: data.degree,
                          field: data.field,
                          institution: data.institution,
                          location: data.location,
                          startDate: data.startDate,
                          endDate: data.endDate,
                          isCurrent: data.isCurrent,
                          grade: data.grade,
                          gradeType: data.gradeType,
                        },
                      ]);
                      setActiveForm(null);
                    }}
                  />
                ) : (
                  <button type="button" className="cb-add-row" onClick={() => setActiveForm('education')}>
                    + Add Education
                  </button>
                )}
              </section>

              {/* 8. Certifications */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Certifications</h2>
                {certificationList.map((cert) => (
                  <div key={cert.id} className="cb-entry-card">
                    <div>
                      <div className="role">{cert.name}</div>
                      <div className="meta">
                        {[cert.issuer, formatDateForResume(cert.date)].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="cb-entry-actions">
                      <button
                        type="button"
                        className="edit"
                        onClick={() => {
                          setWizardIndex(WIZARD_STEPS.indexOf('Certifications'));
                          setActiveForm(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setCertificationList((prev) => prev.filter((x) => x.id !== cert.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {activeForm === 'certification' ? (
                  <CertificationInlineForm
                    onCancel={() => setActiveForm(null)}
                    onSave={(data) => {
                      setCertificationList((prev) => [
                        ...prev,
                        { id: `cert-${Date.now()}`, name: data.name, issuer: data.issuer, date: data.date },
                      ]);
                      setActiveForm(null);
                    }}
                  />
                ) : (
                  <button type="button" className="cb-add-row" onClick={() => setActiveForm('certification')}>
                    + Add Certification
                  </button>
                )}
              </section>

              {/* 9. Achievements */}
              <section className="cb-review-section">
                <h2 className="cb-review-section-title">Achievements</h2>
                {achievementList.map((ach) => (
                  <div key={ach.id} className="cb-entry-card">
                    <div>
                      <div className="role">{ach.title}</div>
                      <div className="meta">
                        {[ach.organization, formatDateForResume(ach.date), ach.description].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="cb-entry-actions">
                      <button
                        type="button"
                        className="edit"
                        onClick={() => {
                          setWizardIndex(WIZARD_STEPS.indexOf('Certifications'));
                          setActiveForm(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="remove"
                        onClick={() =>
                          setAchievementList((prev) => prev.filter((x) => x.id !== ach.id))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {activeForm === 'achievement' ? (
                  <AchievementInlineForm
                    onCancel={() => setActiveForm(null)}
                    onSave={(data) => {
                      setAchievementList((prev) => [
                        ...prev,
                        {
                          id: `ach-${Date.now()}`,
                          title: data.title,
                          organization: data.organization,
                          description: data.description,
                          date: data.date,
                        },
                      ]);
                      setActiveForm(null);
                    }}
                  />
                ) : (
                  <button type="button" className="cb-add-row" onClick={() => setActiveForm('achievement')}>
                    + Add Achievement
                  </button>
                )}
              </section>

              {validationErrors.length > 0 && (
                <div className="cb-validation-errors">
                  {validationErrors.map((err) => (
                    <div key={err}>{err}</div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="cb-save-btn"
                onClick={() => void handleFinishWizard()}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Finish'}
              </button>
            </div>
          </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}
