'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  JOB_DEPARTMENTS,
  JOB_EDUCATION_LEVELS,
  JOB_EXPERIENCE_RANGES,
  JOB_SKILL_SUGGESTIONS,
  JOB_TYPES,
  PREFERRED_LANGUAGES,
  WORK_MODES,
  salaryRangeError,
  type CreateJobPayload,
  type ScreeningQuestion,
  type ScreeningQuestionType,
} from '@careerbridge/shared';
import {
  createEmployerJob,
  extractEmployerJobSkills,
  getEmployerJob,
  publishEmployerJob,
  saveEmployerJobSkillProfile,
  updateEmployerJob,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { Input } from '@/components/ui/Input';
import { SearchableCreatableSelect } from '@/components/ui/SearchableCreatableSelect';
import { CitySelect } from '@/components/ui/CitySelect';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';

const STEPS = [
  {
    id: 1,
    short: 'Basics',
    title: 'Create Job',
    subtitle: 'Job title, department, employment type, and location.',
    icon: '①',
  },
  {
    id: 2,
    short: 'Requirements',
    title: 'Job Requirements',
    subtitle: 'Experience, skills, education, and languages.',
    icon: '②',
  },
  {
    id: 3,
    short: 'Details',
    title: 'Job Details',
    subtitle: 'Salary range, description, and benefits.',
    icon: '③',
  },
  {
    id: 4,
    short: 'Preview',
    title: 'Preview Job',
    subtitle: 'Review everything before you publish.',
    icon: '④',
  },
] as const;

const WORK_MODE_LABELS: Record<(typeof WORK_MODES)[number], string> = {
  ONSITE: 'Onsite',
  HYBRID: 'Hybrid',
  REMOTE: 'Remote',
};

const JOB_TYPE_LABELS: Record<(typeof JOB_TYPES)[number], string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
};

function newQuestionId() {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

function ChoiceGrid({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-primary">{label}</legend>
      <div className="ep-choice">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`ep-choice__btn ${active ? 'is-on' : ''}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-primary">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="ep-create__control"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function NewJobPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams.get('edit') || '';
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [hiringManager, setHiringManager] = useState('');
  const [openings, setOpenings] = useState('1');
  const [category, setCategory] = useState('Software Development');
  const [city, setCity] = useState('Bengaluru');
  const [workMode, setWorkMode] = useState<(typeof WORK_MODES)[number]>('HYBRID');
  const [jobType, setJobType] = useState<(typeof JOB_TYPES)[number]>('FULL_TIME');
  const [experience, setExperience] = useState<(typeof JOB_EXPERIENCE_RANGES)[number]>('2 - 4 Years');
  const [salaryMin, setSalaryMin] = useState('18000');
  const [salaryMax, setSalaryMax] = useState('22000');
  const [languages, setLanguages] = useState<string[]>(['English', 'Tamil']);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [benefitDraft, setBenefitDraft] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [draftJobId, setDraftJobId] = useState<string | null>(null);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const draftJobIdRef = useRef<string | null>(null);
  const [educationMin, setEducationMin] =
    useState<(typeof JOB_EDUCATION_LEVELS)[number]>("Bachelor's Degree");
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<ScreeningQuestion[]>([
    {
      id: newQuestionId(),
      prompt: 'Are you willing to relocate to this job location?',
      type: 'YES_NO',
      required: true,
    },
    {
      id: newQuestionId(),
      prompt: 'What is your notice period?',
      type: 'SHORT_TEXT',
      required: true,
    },
  ]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(Boolean(editJobId));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!editJobId) return;
    let cancelled = false;
    setBootLoading(true);
    getEmployerJob(editJobId)
      .then((job) => {
        if (cancelled) return;
        setDraftId(editJobId);
        setIsEditing(true);
        setTitle(String(job.title || ''));
        setDepartment(String(job.department || ''));
        setHiringManager(String(job.hiringManager || ''));
        setOpenings(String(job.openings || 1));
        setCategory(String(job.category || 'Software Development'));
        setCity(String(job.city || ''));
        if (job.workMode && (WORK_MODES as readonly string[]).includes(String(job.workMode))) {
          setWorkMode(job.workMode as (typeof WORK_MODES)[number]);
        }
        if (job.jobType && (JOB_TYPES as readonly string[]).includes(String(job.jobType))) {
          setJobType(job.jobType as (typeof JOB_TYPES)[number]);
        }
        if (job.experience && (JOB_EXPERIENCE_RANGES as readonly string[]).includes(String(job.experience))) {
          setExperience(job.experience as (typeof JOB_EXPERIENCE_RANGES)[number]);
        }
        if (job.educationMin && (JOB_EDUCATION_LEVELS as readonly string[]).includes(String(job.educationMin))) {
          setEducationMin(job.educationMin as (typeof JOB_EDUCATION_LEVELS)[number]);
        }
        const annualMin = Number(job.salaryMin) || 0;
        const annualMax = Number(job.salaryMax) || 0;
        setSalaryMin(annualMin ? String(Math.round(annualMin / 12)) : '18000');
        setSalaryMax(annualMax ? String(Math.round(annualMax / 12)) : '22000');
        setDescription(String(job.description || ''));
        try {
          const parsedSkills = JSON.parse(String(job.requiredSkills || '[]'));
          if (Array.isArray(parsedSkills)) setSkills(parsedSkills.map(String));
        } catch {
          /* ignore */
        }
        try {
          const benefitRaw = String(job.benefits || '');
          const benefitLines = benefitRaw
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
          const langLine = benefitLines.find((line) => line.toLowerCase().startsWith('languages:'));
          if (langLine) {
            setLanguages(
              langLine
                .replace(/^languages:\s*/i, '')
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            );
          }
          setBenefits(benefitLines.filter((line) => !line.toLowerCase().startsWith('languages:')));
        } catch {
          /* ignore */
        }
        try {
          const parsedQs = JSON.parse(String(job.screeningQuestionsJson || '[]'));
          if (Array.isArray(parsedQs) && parsedQs.length) {
            setQuestions(
              parsedQs.map((item: ScreeningQuestion) => ({
                id: item.id || newQuestionId(),
                prompt: item.prompt || '',
                type: item.type || 'YES_NO',
                required: item.required !== false,
                options: item.options || [],
              })),
            );
          }
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load job for editing.');
      })
      .finally(() => {
        if (!cancelled) setBootLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editJobId]);

  const current = STEPS[step - 1];
  const progressPct = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  function setDraftId(id: string) {
    draftJobIdRef.current = id;
    setDraftJobId(id);
  }

  function buildPayload(publish = false): CreateJobPayload {
    const trimmedDescription = description.trim();
    const monthlyMin = Number(salaryMin) || 0;
    const monthlyMax = Number(salaryMax) || 0;
    const benefitLines = [
      ...benefits,
      languages.length ? `Languages: ${languages.join(', ')}` : '',
    ].filter(Boolean);
    return {
      title: title.trim(),
      department: department.trim(),
      hiringManager: hiringManager.trim() || undefined,
      openings: Number(openings) || 1,
      category,
      city: city.trim(),
      workMode,
      jobType,
      experience,
      salaryMin: monthlyMin * 12,
      salaryMax: monthlyMax * 12,
      requiredSkills: skills,
      educationMin,
      description:
        trimmedDescription.length >= 20
          ? trimmedDescription
          : 'Draft job posting — requirements in progress.',
      benefits: benefitLines.length ? benefitLines.join('\n') : undefined,
      screeningQuestions: questions
        .map((item) => ({
          ...item,
          prompt: item.prompt.trim(),
          options: (item.options || []).map((option) => option.trim()).filter(Boolean),
        }))
        .filter((item) => item.prompt.length >= 3),
      publish,
    };
  }

  async function ensureDraftJob(): Promise<string> {
    if (draftJobIdRef.current) return draftJobIdRef.current;
    const job = await createEmployerJob(buildPayload(false));
    setDraftId(job.id);
    return job.id;
  }

  async function persistSkills(nextSkills: string[]) {
    const previous = skills;
    setSkills(nextSkills);
    setSkillsBusy(true);
    setError('');
    try {
      const jobId = await ensureDraftJob();
      await saveEmployerJobSkillProfile(jobId, {
        requiredSkills: nextSkills,
        educationMin,
      });
    } catch (err) {
      setSkills(previous);
      setError(err instanceof Error ? err.message : 'Could not save skills.');
    } finally {
      setSkillsBusy(false);
    }
  }

  function toggleSkill(skill: string) {
    const nextSkills = skills.includes(skill)
      ? skills.filter((item) => item !== skill)
      : [...skills, skill];
    void persistSkills(nextSkills);
  }

  function removeSkill(skill: string) {
    void persistSkills(skills.filter((item) => item !== skill));
  }

  function addCustomSkill() {
    const next = customSkill.trim();
    if (!next || skills.includes(next)) return;
    setCustomSkill('');
    void persistSkills([...skills, next]);
  }

  async function onExtractSkills() {
    if (description.trim().length < 20) {
      setError('Add a job description first (at least 20 characters), then extract skills.');
      return;
    }
    setExtracting(true);
    setError('');
    try {
      const jobId = await ensureDraftJob();
      await updateEmployerJob(jobId, {
        title: title.trim(),
        description: description.trim(),
        category,
        experience,
        educationMin,
      });
      const profile = await extractEmployerJobSkills(jobId);
      const next = Array.from(
        new Set([...(profile.requiredSkills || []), ...(profile.preferredSkills || [])].map((s) => s.trim()).filter(Boolean)),
      );
      if (!next.length) {
        setError('No skills found in the description. Add skills manually.');
        return;
      }
      await persistSkills(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not extract skills.');
    } finally {
      setExtracting(false);
    }
  }

  const customSelectedSkills = skills.filter((skill) => !(JOB_SKILL_SUGGESTIONS as readonly string[]).includes(skill));

  function updateQuestion(id: string, patch: Partial<ScreeningQuestion>) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  function removeQuestion(id: string) {
    setQuestions((currentQuestions) => currentQuestions.filter((item) => item.id !== id));
  }

  function addQuestion() {
    if (questions.length >= 5) {
      setError('You can add up to 5 screening questions.');
      return;
    }
    setError('');
    setQuestions((currentQuestions) => [
      ...currentQuestions,
      {
        id: newQuestionId(),
        prompt: '',
        type: 'YES_NO',
        required: true,
      },
    ]);
  }

  function validateStep(nextStep: number) {
    if (nextStep <= 1) return null;
    if (title.trim().length < 2) return 'Enter a job title.';
    if (department.trim().length < 2) return 'Enter the department.';
    if (city.trim().length < 2) return 'Select or enter the job location.';
    if (nextStep <= 2) return null;
    if (!skills.length) return 'Select at least one required skill.';
    if (nextStep <= 3) return null;
    const salaryError = salaryRangeError(salaryMin, salaryMax);
    if (salaryError) return salaryError;
    if (description.trim().length < 20) return 'Add a job description of at least 20 characters.';
    if (nextStep <= 4) return null;
    return null;
  }

  function goNext() {
    const problem = validateStep(step + 1);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    void (async () => {
      if (step === 2) {
        setSkillsBusy(true);
        try {
          const jobId = await ensureDraftJob();
          await saveEmployerJobSkillProfile(jobId, {
            requiredSkills: skills,
            educationMin,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save job draft.');
          return;
        } finally {
          setSkillsBusy(false);
        }
      }
      setStep((value) => Math.min(value + 1, STEPS.length));
    })();
  }

  function goBack() {
    setError('');
    setStep((value) => Math.max(value - 1, 1));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validateStep(5);
    if (problem) {
      setError(problem);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = buildPayload(false);
      payload.description = description.trim();
      payload.requiredSkills = skills;

      if (draftJobIdRef.current) {
        await updateEmployerJob(draftJobIdRef.current, payload);
        if (isEditing) {
          router.replace(`/employer/jobs/${draftJobIdRef.current}`);
          return;
        }
        await publishEmployerJob(draftJobIdRef.current);
        router.replace(
          `/employer/jobs/${draftJobIdRef.current}/posted?title=${encodeURIComponent(payload.title)}`,
        );
        return;
      }

      const job = await createEmployerJob({ ...payload, publish: true });
      router.replace(`/employer/jobs/${job.id}/posted?title=${encodeURIComponent(job.title)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not create this job.');
    } finally {
      setLoading(false);
    }
  }

  if (bootLoading) {
    return (
      <EmployerShellFallback title="Edit Job">
        <div className="ep-create">
          <p className="text-sm text-muted">Loading job…</p>
        </div>
      </EmployerShellFallback>
    );
  }

  return (
    <EmployerShellFallback title={isEditing ? 'Edit Job' : 'Submit Job'}>
      <div className="ep-create">
        <p className="ep-dash__eyebrow">Home · Jobs · {isEditing ? 'Edit' : 'Create'}</p>
        <header className="ep-dash__hello">
          <div>
            <h1 className="ep-dash__title">
              {isEditing ? (
                <>
                  Edit <span>job</span>
                </>
              ) : (
                <>
                  Create <span>job</span>
                </>
              )}
            </h1>
            <p className="ep-dash__sub">
              {isEditing
                ? 'Update basics, requirements, and details — then save.'
                : 'Job title, department, employment type, and location.'}
            </p>
          </div>
        </header>

        <nav className="ep-flow-steps" aria-label="Job posting steps">
          {STEPS.map((item, index) => {
            const active = item.id === step;
            const done = item.id < step;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id < step) {
                    setError('');
                    setStep(item.id);
                  }
                }}
                className={`ep-flow-steps__item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
              >
                <span className="ep-flow-steps__icon" aria-hidden>
                  {done ? '✓' : index + 1}
                </span>
                <span className="ep-flow-steps__label">{item.short}</span>
              </button>
            );
          })}
        </nav>

        <div className="ep-flow-progress">
          <div className="ep-flow-progress__meta">
            <span>
              Step {step} of {STEPS.length} · {current.short}
            </span>
            <strong>{progressPct}%</strong>
          </div>
          <div className="ep-flow-progress__bar">
            <span style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <article className="ep-card ep-flow-card">
          <div className="ep-flow-card__head">
            <div>
              <h2>{current.title}</h2>
              <p>{current.subtitle}</p>
            </div>
            <div className="ep-flow-card__tip">
              <span>Tip</span>
              Clear titles and skills improve match quality.
            </div>
          </div>

          <form
            key={step}
            onSubmit={(event) => {
              event.preventDefault();
              if (step < STEPS.length) goNext();
              else void onSubmit(event);
            }}
            className="ep-flow-form"
          >
            {step === 1 ? (
              <div className="ep-flow-block grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input
                    label="Job Title"
                    name="title"
                    required
                    placeholder="Customer Service Executive"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <SearchableCreatableSelect
                  label="Department"
                  id="department"
                  required
                  value={department}
                  onChange={setDepartment}
                  options={JOB_DEPARTMENTS}
                  placeholder="Search department or type your own…"
                  allowCustom
                />
                <div className="sm:col-span-2">
                  <CitySelect label="Location" required value={city} onChange={setCity} />
                </div>
                <div className="sm:col-span-2">
                  <ChoiceGrid
                    label="Job Type"
                    value={jobType}
                    onChange={(value) => setJobType(value as (typeof JOB_TYPES)[number])}
                    options={JOB_TYPES.map((type) => ({ value: type, label: JOB_TYPE_LABELS[type] }))}
                  />
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-5">
                <SelectField
                  label="Experience"
                  required
                  value={experience}
                  onChange={(value) => setExperience(value as (typeof JOB_EXPERIENCE_RANGES)[number])}
                  options={JOB_EXPERIENCE_RANGES.map((item) => ({ value: item, label: item }))}
                />
                <div className="ep-flow-block">
                  <SkillSearchCombobox
                    label="Required Skills"
                    selected={skills}
                    onAdd={(skill) => {
                      if (!skills.includes(skill)) setSkills([...skills, skill]);
                    }}
                    onRemove={(skill) => setSkills(skills.filter((item) => item !== skill))}
                    placeholder="Search skills or type to add…"
                  />
                </div>
                <SelectField
                  label="Education"
                  required
                  value={educationMin}
                  onChange={(value) => setEducationMin(value as (typeof JOB_EDUCATION_LEVELS)[number])}
                  options={JOB_EDUCATION_LEVELS.map((item) => ({ value: item, label: item }))}
                />
                <div>
                  <p className="mb-2 text-sm font-semibold text-primary">Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {PREFERRED_LANGUAGES.map((lang) => {
                      const active = languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() =>
                            setLanguages((current) =>
                              active ? current.filter((item) => item !== lang) : [...current, lang],
                            )
                          }
                          className={`ep-choice__btn ${active ? 'is-on' : ''}`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-5">
                <div className="ep-flow-block grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Salary from (₹ / month)"
                    name="salaryMin"
                    inputMode="numeric"
                    placeholder="18000"
                    value={salaryMin}
                    onChange={(event) => setSalaryMin(event.target.value.replace(/\D/g, ''))}
                  />
                  <Input
                    label="Salary to (₹ / month)"
                    name="salaryMax"
                    inputMode="numeric"
                    placeholder="22000"
                    value={salaryMax}
                    onChange={(event) => setSalaryMax(event.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <Textarea
                  label="Job Description"
                  name="description"
                  required
                  placeholder="Describe responsibilities, day-to-day work, and what success looks like…"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <div>
                  <p className="mb-2 text-sm font-semibold text-primary">Benefits</p>
                  {benefits.length ? (
                    <ul className="mb-2 flex flex-wrap gap-2">
                      {benefits.map((item) => (
                        <li
                          key={item}
                          className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary"
                        >
                          {item}
                          <button
                            type="button"
                            onClick={() => setBenefits((rows) => rows.filter((row) => row !== item))}
                            aria-label={`Remove ${item}`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex gap-2">
                    <input
                      value={benefitDraft}
                      onChange={(e) => setBenefitDraft(e.target.value)}
                      placeholder="e.g. Health insurance"
                      className="ep-create__control min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      block={false}
                      size="sm"
                      onClick={() => {
                        const next = benefitDraft.trim();
                        if (!next || benefits.includes(next)) return;
                        setBenefits((rows) => [...rows, next]);
                        setBenefitDraft('');
                      }}
                    >
                      + Add Benefit
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="ep-create__preview">
                <div>
                  <h3 className="text-lg font-extrabold text-primary">{title || 'Job title'}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {department || 'Department'} · {city || 'Location'} · ₹{salaryMin || '0'}–₹{salaryMax || '0'} / month
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Requirements</p>
                  <ul className="mt-2 space-y-1 text-sm text-primary">
                    <li>✓ {experience}</li>
                    <li>✓ {educationMin}</li>
                    {skills.map((skill) => (
                      <li key={skill}>✓ {skill}</li>
                    ))}
                    {languages.length ? <li>✓ {languages.join(', ')}</li> : null}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">About the job</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{description || '—'}</p>
                </div>
              </div>
            ) : null}

            {error ? (
                <p className="ep-alert ep-alert--error">{error}</p>
              ) : null}

              <div className="ep-flow-foot">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={goBack}
                    block={false}
                    className="ep-create__back"
                  >
                    Back
                  </Button>
                ) : (
                  <span className="ep-flow-foot__hint">Ready when you are.</span>
                )}
                <Button
                  type="submit"
                  size="sm"
                  loading={loading}
                  loadingLabel={step === STEPS.length ? (isEditing ? 'Saving…' : 'Publishing…') : 'Please wait…'}
                  block={false}
                  className="ep-btn-save"
                >
                  {step === STEPS.length ? (isEditing ? 'Save Job' : 'Publish Job') : 'Continue'}
                </Button>
              </div>
            </form>
        </article>
      </div>
    </EmployerShellFallback>
  );
}
