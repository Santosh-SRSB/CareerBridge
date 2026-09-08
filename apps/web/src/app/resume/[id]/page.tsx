'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { RESUME_TEMPLATES, type ResumeContent, type ResumeRecord } from '@careerbridge/shared';
import { aiReviewResume, createResume, downloadResume, getCandidateMe, getResume, saveBase64File, savePassport, updateCandidateMe, updateResume } from '@/lib/api';
import { downloadResumePdfFile } from '@/lib/resume-pdf';
import { CandidateShell } from '@/components/CandidatePortal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { ScoreRing } from '@/components/ScoreRing';
import { ResumePaper } from '@/components/ResumePaper';
import { mapResumeContentToPassportPayload } from '@/features/resume/resume-content-to-passport';
import { patchStoredUser } from '@/lib/session';

type StepId = 'personal' | 'education' | 'experience' | 'skills' | 'summary' | 'ai-polish' | 'finalize';

interface StepMeta {
  id: StepId;
  label: string;
  stepNumber: number;
  description: string;
}

const STEPS: StepMeta[] = [
  { id: 'personal', label: '1. Personal Info', stepNumber: 1, description: 'Name, contact details, and location' },
  { id: 'education', label: '2. Education', stepNumber: 2, description: 'Degrees, diplomas, and institutions' },
  { id: 'experience', label: '3. Experience', stepNumber: 3, description: 'Work, internships, and key duties' },
  { id: 'skills', label: '4. Skills', stepNumber: 4, description: 'Technical, domain, and soft competencies' },
  { id: 'summary', label: '5. Objective & Summary', stepNumber: 5, description: 'Career statement and strengths' },
  { id: 'ai-polish', label: '6. ATS & Improve with AI', stepNumber: 6, description: 'Score, suggestions, accept or reject' },
  { id: 'finalize', label: '7. Save Resume', stepNumber: 7, description: 'Save version to cloud — download optional' },
];

interface AiReviewData {
  score: number;
  strengths: string[];
  improvements: string[];
  missingSkills: string[];
  suggestedSections?: Record<string, string>;
  provider?: string;
}

export default function ResumeEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAutofillPath = searchParams.get('path') === 'autofill';

  const [resume, setResume] = useState<ResumeRecord | null>(null);
  const [content, setContent] = useState<ResumeContent | null>(null);
  const [title, setTitle] = useState('');
  const [targetJobTitle, setTargetJobTitle] = useState('');
  const [template, setTemplate] = useState('CLASSIC');

  const [currentStep, setCurrentStep] = useState<StepId>('personal');
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [newLangInput, setNewLangInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // AI Review State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AiReviewData | null>(null);
  const [aiError, setAiError] = useState('');
  const [approvedSuggestions, setApprovedSuggestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!params.id) return;
    getResume(params.id)
      .then((item) => {
        setResume(item);
        setTitle(item.title);
        setTargetJobTitle(item.targetJobTitle || '');
        setTemplate(item.template || 'CLASSIC');
        setContent(JSON.parse(JSON.stringify(item.content)));
      })
      .catch(() => {
        router.replace('/resume');
      });

    getCandidateMe()
      .then((profile) => setPhotoUrl(profile.photoUrl || null))
      .catch(() => setPhotoUrl(null));
  }, [params.id, router]);

  if (!resume || !content) {
    return (
      <CandidateShell>
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal border-t-transparent" />
          <p className="text-sm font-semibold text-muted">Loading your resume...</p>
        </div>
      </CandidateShell>
    );
  }

  // --- Step Navigation Helpers ---
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  function goToNextStep() {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].id);
    }
  }

  function goToPrevStep() {
    if (currentStepIndex > 0) {
      setCurrentStep(STEPS[currentStepIndex - 1].id);
    }
  }

  // --- State Mutators ---
  function updateContact(field: keyof Pick<ResumeContent, 'fullName' | 'city' | 'phone'>, val: string) {
    setContent((prev) => (prev ? { ...prev, [field]: val || null } : prev));
  }

  function updateSummary(val: string) {
    setContent((prev) => (prev ? { ...prev, summary: val } : prev));
  }

  function addSkill(skillName: string) {
    const trimmed = skillName.trim();
    if (!trimmed || !content) return;
    if (content.skills.includes(trimmed)) return;
    setContent((prev) => (prev ? { ...prev, skills: [...prev.skills, trimmed] } : prev));
    setNewSkillInput('');
  }

  function removeSkill(index: number) {
    setContent((prev) => (prev ? { ...prev, skills: prev.skills.filter((_, i) => i !== index) } : prev));
  }

  function addLanguage(lang: string) {
    const trimmed = lang.trim();
    if (!trimmed || !content) return;
    if (content.languages.includes(trimmed)) return;
    setContent((prev) => (prev ? { ...prev, languages: [...prev.languages, trimmed] } : prev));
    setNewLangInput('');
  }

  function removeLanguage(index: number) {
    setContent((prev) => (prev ? { ...prev, languages: prev.languages.filter((_, i) => i !== index) } : prev));
  }

  function addExperience() {
    setContent((prev) =>
      prev
        ? {
            ...prev,
            experiences: [
              ...prev.experiences,
              {
                company: 'Organization / Company',
                jobTitle: 'Job Title',
                isInternship: false,
                description: 'Key responsibilities and achievements...',
              },
            ],
          }
        : prev,
    );
  }

  function updateExperience(index: number, field: string, val: any) {
    setContent((prev) => {
      if (!prev) return prev;
      const nextExp = [...prev.experiences];
      nextExp[index] = { ...nextExp[index], [field]: val };
      return { ...prev, experiences: nextExp };
    });
  }

  function removeExperience(index: number) {
    setContent((prev) => (prev ? { ...prev, experiences: prev.experiences.filter((_, i) => i !== index) } : prev));
  }

  function addEducation() {
    setContent((prev) =>
      prev
        ? {
            ...prev,
            education: [
              ...prev.education,
              {
                qualification: 'Bachelor / Diploma / Schooling',
                institution: 'College / Institute',
                yearCompleted: new Date().getFullYear(),
              },
            ],
          }
        : prev,
    );
  }

  function updateEducation(index: number, field: string, val: any) {
    setContent((prev) => {
      if (!prev) return prev;
      const nextEdu = [...prev.education];
      nextEdu[index] = { ...nextEdu[index], [field]: val };
      return { ...prev, education: nextEdu };
    });
  }

  function removeEducation(index: number) {
    setContent((prev) => (prev ? { ...prev, education: prev.education.filter((_, i) => i !== index) } : prev));
  }

  // --- Actions ---
  async function onSave(e?: FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    try {
      const updated = await updateResume(params.id, {
        title,
        targetJobTitle: targetJobTitle || undefined,
        template,
        summary: content?.summary,
        content: content as Record<string, unknown>,
      });
      setResume(updated);
      setSaveMessage('Resume version updated and saved successfully!');
      setTimeout(() => setSaveMessage(''), 3500);
      return true;
    } catch {
      setSaveMessage('Failed to save changes. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** Path A step 12: create / refresh Career Passport from finalized resume data. */
  async function applyResumeToProfile() {
    if (!content) return false;
    const payload = mapResumeContentToPassportPayload(content);
    const profile = await savePassport(payload);
    const preferredLanguage = content.languages?.[0]?.trim();
    if (preferredLanguage) {
      await updateCandidateMe({ preferredLanguage }).catch(() => undefined);
    }
    patchStoredUser({
      firstName: profile.firstName,
      onboardingCompleted: true,
    });
    return true;
  }

  async function onRunAiReview() {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await aiReviewResume(params.id, {
        targetRole: targetJobTitle || resume?.targetJobTitle || 'General Professional',
      });
      if (res && res.score !== undefined) {
        setAiReview(res);
        if (resume) {
          setResume({ ...resume, score: res.score });
        }
      }
    } catch (err: any) {
      setAiError(err?.message || 'Could not complete AI review at this time.');
    } finally {
      setAiLoading(false);
    }
  }

  async function onDownload() {
    if (!content) return;
    setDownloading(true);
    try {
      try {
        const result = await downloadResume(params.id);
        if (result?.pdf) {
          saveBase64File(result.pdf, result.fileName, result.mimeType || 'application/pdf');
          setDownloading(false);
          return;
        }
      } catch {}

      await downloadResumePdfFile({
        content: { ...content, summary: content.summary },
        template,
        photoUrl: content.includePhoto === false ? null : photoUrl,
        fileName: `${title.replace(/\s+/g, '-') || 'Resume'}.pdf`,
      });
    } finally {
      setDownloading(false);
    }
  }

  async function onDuplicate() {
    if (!content) return;
    setDuplicating(true);
    try {
      const dup = await createResume({
        title: `${title} (Copy)`,
        targetJobTitle: targetJobTitle || undefined,
        template,
        content: content as Record<string, unknown>,
      });
      router.push(`/resume/${dup.id}`);
    } catch {
      setSaveMessage('Could not duplicate resume.');
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <CandidateShell>
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/10 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/resume"
            className="inline-flex items-center gap-1 text-sm font-bold text-teal transition hover:underline"
          >
            ← My Resumes
          </Link>
          <span className="text-primary/20">|</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Version {resume.version} ({resume.kind})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onDuplicate}
            loading={duplicating}
            loadingLabel="Cloning..."
            className="text-xs font-bold"
          >
            Duplicate
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onDownload}
            loading={downloading}
            loadingLabel="Generating..."
            className="text-xs font-bold"
          >
            📥 Download PDF
          </Button>
          <Button
            type="button"
            onClick={() => onSave()}
            loading={saving}
            loadingLabel="Saving..."
            className="text-xs font-bold"
          >
            Save Changes
          </Button>
        </div>
      </div>

      {saveMessage && (
        <div
          className={`rounded-md p-3 text-sm font-semibold ${
            saveMessage.includes('success') ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
          }`}
        >
          {saveMessage}
        </div>
      )}

      {isAutofillPath ? (
        <div className="rounded-xl border border-teal/20 bg-teal/5 px-4 py-3 text-sm text-primary">
          <p className="font-bold text-teal">Path A · Autofill with Resume</p>
          <p className="mt-1 text-xs text-muted">
            Fill remaining sections → Check ATS score → Improve with AI (accept/reject) → Save resume
            → Profile &amp; passport created → Dashboard (download optional)
          </p>
        </div>
      ) : null}

      {/* Hero Header with ATS Score */}
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="font-display rounded-md border-b-2 border-transparent bg-transparent text-2xl font-extrabold text-primary hover:border-primary/20 focus:border-teal focus:bg-white focus:px-2 focus:outline-none sm:text-3xl"
              placeholder="Resume Title"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Target Role:</span>
            <input
              type="text"
              value={targetJobTitle}
              onChange={(e) => setTargetJobTitle(e.target.value)}
              className="rounded border border-primary/15 bg-white px-2 py-1 text-xs font-medium text-primary focus:border-teal focus:outline-none"
              placeholder="e.g. Customer Service Specialist"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-primary/10 bg-white p-3 shadow-sm">
          <ScoreRing value={resume.score} size={58} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal">ATS Readiness</span>
              <span className="rounded bg-teal/10 px-1.5 py-0.5 text-[10px] font-extrabold text-teal">
                {resume.score}/100
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {resume.score >= 80 ? 'Optimized for job applications' : 'Run AI review step to boost score'}
            </p>
          </div>
        </div>
      </div>

      {/* Step Wizard Bar (HLD Diagram 7 Flow) */}
      <div className="rounded-xl border border-primary/10 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between overflow-x-auto gap-2 pb-1">
          {STEPS.map((step) => {
            const isCurrent = currentStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition ${
                  isCurrent
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-[#faf8f3] text-primary/70 hover:bg-primary/5 hover:text-primary'
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${
                    isCurrent ? 'bg-white text-teal' : 'bg-primary/10 text-primary'
                  }`}
                >
                  {step.stepNumber}
                </span>
                <span className="whitespace-nowrap text-xs font-bold">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Workspace */}
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)]">
        {/* LEFT COLUMN: Current Step Form */}
        <div className={viewMode === 'preview' ? 'hidden min-w-0 xl:block' : 'block min-w-0'}>
          <div className="cb-dash-card space-y-6 p-5 sm:p-6">
            {/* Step Header */}
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-teal">
                  Step {currentStepIndex + 1} of {STEPS.length}
                </span>
                <h2 className="text-lg font-bold text-primary">{STEPS[currentStepIndex].label}</h2>
                <p className="text-xs text-muted">{STEPS[currentStepIndex].description}</p>
              </div>
            </div>

            {/* STEP 1: PERSONAL INFORMATION */}
            {currentStep === 'personal' && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Full Name"
                    value={content.fullName || ''}
                    onChange={(e) => updateContact('fullName', e.target.value)}
                    placeholder="e.g. Rahul Kumar"
                  />
                  <Input
                    label="Location / City"
                    value={content.city || ''}
                    onChange={(e) => updateContact('city', e.target.value)}
                    placeholder="e.g. Chennai, Tamil Nadu"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Phone Number"
                    value={content.phone || ''}
                    onChange={(e) => updateContact('phone', e.target.value)}
                    placeholder="e.g. +91 9876543210"
                  />
                  <div className="flex items-center gap-3 pt-6">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-primary">
                      <input
                        type="checkbox"
                        checked={content.includePhoto !== false}
                        onChange={(e) =>
                          setContent((prev) => (prev ? { ...prev, includePhoto: e.target.checked } : prev))
                        }
                        className="rounded border-primary/20 text-teal focus:ring-teal"
                      />
                      Include profile photo in resume
                    </label>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <span className="text-xs font-bold text-primary">Spoken / Written Languages</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLangInput}
                      onChange={(e) => setNewLangInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addLanguage(newLangInput);
                        }
                      }}
                      placeholder="e.g. English, Hindi, Tamil"
                      className="flex-1 rounded-md border border-primary/15 bg-[#faf8f3] px-3.5 py-2 text-sm text-primary focus:border-teal focus:bg-white focus:outline-none"
                    />
                    <Button type="button" onClick={() => addLanguage(newLangInput)} className="text-xs font-bold">
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {content.languages.map((lang, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                      >
                        {lang}
                        <button
                          type="button"
                          onClick={() => removeLanguage(idx)}
                          className="text-primary/60 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: EDUCATION */}
            {currentStep === 'education' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">Add your degrees, diplomas, or certificates.</p>
                  <Button type="button" variant="secondary" onClick={addEducation} className="text-xs font-bold">
                    + Add Degree
                  </Button>
                </div>

                {!content.education.length ? (
                  <div className="rounded-lg border border-dashed border-primary/20 p-6 text-center">
                    <p className="text-xs text-muted">No education records added yet.</p>
                    <Button type="button" variant="secondary" onClick={addEducation} className="mt-3 text-xs">
                      + Add Education
                    </Button>
                  </div>
                ) : (
                  content.education.map((edu, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-lg border border-primary/10 bg-[#faf8f3] p-4 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-teal">Degree #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeEducation(idx)}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Qualification / Degree"
                          value={edu.qualification}
                          onChange={(e) => updateEducation(idx, 'qualification', e.target.value)}
                          placeholder="e.g. B.Com, Diploma, 12th Standard"
                        />
                        <Input
                          label="Institution"
                          value={edu.institution || ''}
                          onChange={(e) => updateEducation(idx, 'institution', e.target.value)}
                          placeholder="e.g. Madras University"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Year of Completion"
                          type="number"
                          value={edu.yearCompleted || ''}
                          onChange={(e) =>
                            updateEducation(idx, 'yearCompleted', parseInt(e.target.value, 10) || null)
                          }
                          placeholder="e.g. 2024"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* STEP 3: EXPERIENCE */}
            {currentStep === 'experience' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">Jobs, internships, or relevant informal work experience.</p>
                  <Button type="button" variant="secondary" onClick={addExperience} className="text-xs font-bold">
                    + Add Experience
                  </Button>
                </div>

                {!content.experiences.length ? (
                  <div className="rounded-lg border border-dashed border-primary/20 p-6 text-center">
                    <p className="text-xs text-muted">No experience entries added.</p>
                    <Button type="button" variant="secondary" onClick={addExperience} className="mt-3 text-xs">
                      + Add Work Experience / Internship
                    </Button>
                  </div>
                ) : (
                  content.experiences.map((exp, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-lg border border-primary/10 bg-[#faf8f3] p-4 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold uppercase text-teal">Position #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeExperience(idx)}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label="Job Title"
                          value={exp.jobTitle}
                          onChange={(e) => updateExperience(idx, 'jobTitle', e.target.value)}
                          placeholder="e.g. Customer Support Executive"
                        />
                        <Input
                          label="Company / Employer"
                          value={exp.company}
                          onChange={(e) => updateExperience(idx, 'company', e.target.value)}
                          placeholder="e.g. Retail Corp"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-primary">
                          <input
                            type="checkbox"
                            checked={exp.isInternship}
                            onChange={(e) => updateExperience(idx, 'isInternship', e.target.checked)}
                            className="rounded border-primary/20 text-teal"
                          />
                          Internship
                        </label>
                      </div>

                      <Textarea
                        label="Description & Key Responsibilities"
                        value={exp.description || ''}
                        onChange={(e) => updateExperience(idx, 'description', e.target.value)}
                        placeholder="• Handled customer enquiries and achieved 98% resolution..."
                        className="min-h-24"
                      />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* STEP 4: SKILLS */}
            {currentStep === 'skills' && (
              <div className="space-y-4">
                <p className="text-xs text-muted">
                  Skills are parsed by ATS algorithms to match you against employer requirements.
                </p>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill(newSkillInput);
                      }
                    }}
                    placeholder="Type skill and press Enter (e.g. Communication, CRM, MS Excel)"
                    className="flex-1 rounded-md border border-primary/15 bg-[#faf8f3] px-3.5 py-2 text-sm text-primary focus:border-teal focus:bg-white focus:outline-none"
                  />
                  <Button type="button" onClick={() => addSkill(newSkillInput)} className="text-xs font-bold">
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {content.skills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal-900"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(idx)}
                        className="text-teal-900 hover:text-red-600"
                        title="Remove skill"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {!content.skills.length && (
                    <p className="text-xs text-muted">No skills added yet. Add at least 4-5 skills.</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: OBJECTIVE & SUMMARY */}
            {currentStep === 'summary' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">
                    Write a concise 3–4 sentence statement highlighting your strengths and target career goals.
                  </p>
                  <button
                    type="button"
                    onClick={onRunAiReview}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 transition hover:bg-amber-200"
                  >
                    ✨ AI Suggestions
                  </button>
                </div>

                <Textarea
                  label="Career Objective & Summary"
                  name="summary"
                  value={content.summary}
                  onChange={(e) => updateSummary(e.target.value)}
                  placeholder="Enthusiastic and results-oriented professional with experience in customer support and administrative workflows..."
                  className="min-h-44 leading-6"
                />
              </div>
            )}

            {/* STEP 6: AI POLISH & APPROVAL (Diagram 7) */}
            {currentStep === 'ai-polish' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-primary">AI Content Review & Approval</h3>
                    <p className="text-xs text-muted">
                      AI generates suggestions; you remain in control of accepting each change (HLD Diagram 7).
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={onRunAiReview}
                    loading={aiLoading}
                    loadingLabel="Analyzing..."
                    className="text-xs font-bold"
                  >
                    🚀 Run Gemini AI Analysis
                  </Button>
                </div>

                {aiError && (
                  <div className="rounded-lg bg-red-50 p-3.5 text-xs text-red-700">
                    <p className="font-bold">Analysis error:</p>
                    <p className="mt-0.5">{aiError}</p>
                  </div>
                )}

                {!aiReview && !aiLoading && (
                  <div className="rounded-xl border border-dashed border-primary/20 bg-[#faf8f3] p-8 text-center space-y-3">
                    <span className="text-3xl">✨</span>
                    <h4 className="text-sm font-bold text-primary">Ready to Analyze Your Resume</h4>
                    <p className="text-xs text-muted max-w-md mx-auto">
                      Click the button above to run our centralized AI Gateway. We will check ATS score, identify missing skills, and suggest improvements.
                    </p>
                    <Button type="button" onClick={onRunAiReview} className="text-xs font-bold">
                      Analyze Now
                    </Button>
                  </div>
                )}

                {aiReview && (
                  <div className="space-y-6">
                    {/* ATS Score Card */}
                    <div className="flex items-center gap-4 rounded-xl bg-[#faf8f3] p-4 ring-1 ring-primary/10">
                      <ScoreRing value={aiReview.score} size={64} />
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-teal">ATS Readiness Score</span>
                        <p className="text-2xl font-extrabold text-primary">{aiReview.score}/100</p>
                        <p className="text-xs text-muted">
                          {aiReview.score >= 80 ? 'Well-aligned for candidate screening' : 'Review recommendations below'}
                        </p>
                      </div>
                    </div>

                    {/* Missing Skills Recommendations */}
                    {aiReview.missingSkills?.length ? (
                      <div className="rounded-xl border border-teal/20 bg-teal/5 p-4 space-y-2">
                        <p className="text-xs font-bold text-teal-900">⚡ Missing Keywords for Target Role:</p>
                        <p className="text-xs text-muted">Click any skill to instantly add it to your resume:</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {aiReview.missingSkills.map((sk) => (
                            <button
                              key={sk}
                              type="button"
                              onClick={() => addSkill(sk)}
                              className="rounded-full border border-teal/30 bg-white px-3 py-1 text-xs font-bold text-teal transition hover:bg-teal hover:text-white"
                            >
                              + {sk}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Suggestions & Approval */}
                    {aiReview.suggestedSections && Object.keys(aiReview.suggestedSections).length > 0 ? (
                      <div className="space-y-4">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary">
                          AI Suggested Enhancements
                        </h4>
                        {Object.entries(aiReview.suggestedSections).map(([sec, text]) => (
                          <div key={sec} className="rounded-xl border border-primary/15 bg-white p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase text-teal">{sec} Suggestion</span>
                              {approvedSuggestions[sec] ? (
                                <span className="rounded bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                                  ✓ Applied & Approved
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (sec === 'summary') updateSummary(text);
                                    setApprovedSuggestions((prev) => ({ ...prev, [sec]: true }));
                                    setSaveMessage(`Applied AI suggestion for ${sec}!`);
                                  }}
                                  className="rounded bg-teal px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-teal-700"
                                >
                                  Approve & Apply
                                </button>
                              )}
                            </div>
                            <p className="rounded-lg bg-[#faf8f3] p-3 text-xs leading-5 text-primary/90">{text}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Strengths & Improvements */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-lg bg-green-50 p-4 space-y-2">
                        <p className="text-xs font-bold text-green-900">✓ Strengths</p>
                        <ul className="space-y-1 text-xs text-green-800">
                          {aiReview.strengths?.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-4 space-y-2">
                        <p className="text-xs font-bold text-amber-900">⚠ Recommendations</p>
                        <ul className="space-y-1 text-xs text-amber-800">
                          {aiReview.improvements?.map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 7: SAVE (download optional) */}
            {currentStep === 'finalize' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-primary">Save Resume</h3>
                  <p className="text-xs text-muted">
                    Save creates a resume version and stores the file in cloud storage with metadata in
                    PostgreSQL. Download to your device is optional after save.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-bold text-primary">Resume Template</span>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {RESUME_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl}
                        type="button"
                        onClick={() => setTemplate(tpl)}
                        className={`rounded-xl border p-3.5 text-center transition ${
                          template === tpl
                            ? 'border-teal bg-teal/10 text-teal ring-2 ring-teal/20 font-extrabold'
                            : 'border-primary/10 bg-[#faf8f3] text-primary/70 hover:border-primary/30 font-semibold'
                        }`}
                      >
                        <span className="block text-sm">{tpl}</span>
                        <span className="text-[10px] text-muted">ATS Ready</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/10 bg-[#faf8f3] p-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-primary">Save to platform</h4>
                      <p className="text-xs text-muted">
                        User edits → Save → Create version → Cloud Storage + PostgreSQL
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => onSave()}
                      loading={saving}
                      loadingLabel="Saving..."
                      className="text-xs font-bold"
                    >
                      Save Resume
                    </Button>
                  </div>
                  <div className="flex flex-col gap-3 border-t border-primary/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-primary">Optional download</h4>
                      <p className="text-xs text-muted">Download is not part of save — use after you save.</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={onDownload}
                      loading={downloading}
                      loadingLabel="Generating PDF..."
                      className="text-xs font-bold"
                    >
                      Download PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step Navigation Controls (Previous / Next / Save) */}
            <div className="flex items-center justify-between border-t border-primary/10 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={goToPrevStep}
                disabled={currentStepIndex === 0}
                className="text-xs font-bold"
              >
                ← Previous Step
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSave()}
                  loading={saving}
                  loadingLabel="Saving..."
                  className="text-xs font-bold"
                >
                  Save Version
                </Button>

                {currentStepIndex < STEPS.length - 1 ? (
                  <Button type="button" onClick={goToNextStep} className="text-xs font-bold">
                    Next: {STEPS[currentStepIndex + 1].label} →
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await onSave();
                      if (!ok) return;
                      if (isAutofillPath) {
                        setSaving(true);
                        try {
                          await applyResumeToProfile();
                          setSaveMessage('Profile & passport updated from your resume.');
                          router.push('/dashboard');
                        } catch {
                          setSaveMessage(
                            'Resume saved, but profile could not be updated. You can finish details in Career Passport.',
                          );
                        } finally {
                          setSaving(false);
                        }
                      }
                    }}
                    loading={saving}
                    loadingLabel="Saving..."
                    className="text-xs font-bold"
                  >
                    {isAutofillPath ? 'Save & finish' : 'Save Resume'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Template Preview */}
        <div className={viewMode === 'edit' ? 'hidden min-w-0 xl:block' : 'block min-w-0'}>
          <div className="sticky top-24 space-y-3">
            {/* Template Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary/5 p-2">
              <span className="text-xs font-bold text-primary">Live Preview ({template}):</span>
              <div className="flex flex-wrap gap-1">
                {RESUME_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    onClick={() => setTemplate(tpl)}
                    className={`rounded px-2.5 py-1 text-xs font-bold transition ${
                      template === tpl ? 'bg-teal text-white shadow-sm' : 'bg-white text-primary hover:bg-primary/5'
                    }`}
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>

            {/* Paper Document */}
            <div className="cb-resume-desk max-h-[820px] overflow-y-auto rounded-xl p-4 sm:p-6">
              <ResumePaper content={content} summary={content.summary} targetJobTitle={targetJobTitle} />
            </div>
          </div>
        </div>
      </div>
    </CandidateShell>
  );
}
