'use client';

import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';
import { jobPublishToast } from '@/lib/job-status';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  JOB_DEPARTMENTS,
  JOB_EDUCATION_LEVELS,
  JOB_EXPERIENCE_RANGES,
  toJobExperienceRange,
  JOB_SKILL_SUGGESTIONS,
  JOB_TITLE_SUGGESTIONS,
  JOB_TYPES,
  PREFERRED_LANGUAGES,
  WORK_MODES,
  JOB_DESCRIPTION_MAX,
  jobSalaryRequiredError,
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
import { SkillSearchCombobox } from '@/components/resume/SkillSearchCombobox';
import { EvAlert, EvSkeleton, EvStepHead } from '@/components/employer/ui';

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
    <fieldset className="ev-fieldset">
      <legend className="ev-sub2">{label.toUpperCase()}</legend>
      <div className="ev-chips2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`ev-chipbtn${active ? ' on' : ''}`}
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
    <label className="ev-form ev-field">
      <span className="ev-flabel">
        {label}
        {required ? <em aria-hidden="true"> *</em> : null}
      </span>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
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
  const [experience, setExperience] = useState<(typeof JOB_EXPERIENCE_RANGES)[number]>('2–5 yrs');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [languages, setLanguages] = useState<string[]>(['English', 'Tamil']);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [benefitDraft, setBenefitDraft] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [draftJobId, setDraftJobId] = useState<string | null>(null);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const draftJobIdRef = useRef<string | null>(null);
  const [educationMin, setEducationMin] = useState("Bachelor's Degree");
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
  const [salaryErrors, setSalaryErrors] = useState<{ min?: string; max?: string }>({});
  const [draftSaving, setDraftSaving] = useState(false);
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
        const storedExperience = toJobExperienceRange(job.experience ? String(job.experience) : null);
        if (storedExperience) setExperience(storedExperience);
        if (job.educationMin) {
          setEducationMin(String(job.educationMin));
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
      salaryMin: monthlyMin > 0 ? monthlyMin * 12 : undefined,
      salaryMax: monthlyMax > 0 ? monthlyMax * 12 : undefined,
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
    if (!skills.length) return 'At least one skill is required.';
    if (!educationMin.trim()) return 'Education is required.';
    if (nextStep <= 3) return null;
    const required = jobSalaryRequiredError(salaryMin, salaryMax);
    if (required) {
      setSalaryErrors(required.startsWith('Minimum') ? { min: required } : { max: required });
      return required;
    }
    setSalaryErrors({});
    const salaryError = salaryRangeError(salaryMin, salaryMax);
    if (salaryError) return salaryError;
    if (!description.trim()) return 'Job description is required.';
    if (description.trim().length < 20) return 'Add a job description of at least 20 characters.';
    if (description.length > JOB_DESCRIPTION_MAX) {
      return `Job description must be ${JOB_DESCRIPTION_MAX} characters or fewer.`;
    }
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
          setError(userFacingError(err, 'save job draft'));
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

  function editStep(target: number) {
    setError('');
    setStep(target);
  }

  async function saveDraft() {
    const problem = validateStep(2);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setDraftSaving(true);
    try {
      const payload = buildPayload(false);
      if (draftJobIdRef.current) {
        await updateEmployerJob(draftJobIdRef.current, payload);
      } else {
        const job = await createEmployerJob(payload);
        setDraftId(job.id);
      }
      toast.success('Draft saved. Finish and publish it any time from My Jobs.');
    } catch (err) {
      const text = userFacingError(err, 'save the draft');
      setError(text);
      toast.error(text);
    } finally {
      setDraftSaving(false);
    }
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
        toast.success(jobPublishToast(await publishEmployerJob(draftJobIdRef.current)));
        router.replace(
          `/employer/jobs/${draftJobIdRef.current}/posted?title=${encodeURIComponent(payload.title)}`,
        );
        return;
      }

      const job = await createEmployerJob({ ...payload, publish: true });
      toast.success(jobPublishToast(job));
      router.replace(`/employer/jobs/${job.id}/posted?title=${encodeURIComponent(job.title)}`);
    } catch (err) {
      const text = userFacingError(err, 'publish job');
      setError(text);
      toast.error(text);
    } finally {
      setLoading(false);
    }
  }

  if (bootLoading) {
    return (
      <EmployerShellFallback title="Edit Job">
        <div className="ev-wzp">
          <div className="ev-mt">
            <EvSkeleton height={320} />
          </div>
          <p className="ev-status">Loading job…</p>
        </div>
      </EmployerShellFallback>
    );
  }

  return (
    <EmployerShellFallback title={isEditing ? 'Edit Job' : 'Submit Job'}>
      <div className="ev-wzp">
        <div className="ev-jh">
          <div>
            <Link href="/employer/jobs" className="ev-back">
              ← My jobs
            </Link>
            <h1>{isEditing ? 'Edit job' : 'Post a new job'}</h1>
            <p>
              {isEditing
                ? 'Update the role details, then save your changes.'
                : 'Four quick steps. You can save a draft at any time.'}
            </p>
          </div>
        </div>

        <nav className="ev-wz" aria-label={`Job posting steps, ${progressPct}% complete`}>
          {STEPS.map((item) => {
            const active = item.id === step;
            const done = item.id < step;
            return (
              <button
                key={item.id}
                type="button"
                data-n={done ? '✓' : item.id}
                aria-current={active ? 'step' : undefined}
                aria-disabled={item.id > step}
                onClick={() => {
                  if (item.id < step) {
                    setError('');
                    setStep(item.id);
                  }
                }}
                className={active ? 'on' : done ? 'done' : undefined}
              >
                {item.short}
              </button>
            );
          })}
        </nav>

        <article className="ev-card">
          <EvStepHead n={step} title={current.title} hint={current.subtitle} />

          <form
            key={step}
            onSubmit={(event) => {
              event.preventDefault();
              if (step < STEPS.length) goNext();
              else void onSubmit(event);
            }}
            noValidate
          >
            {step === 1 ? (
              <div className="ev-f ev-stack">
                <div className="ev-span">
                  <SearchableCreatableSelect
                    label="Job Title"
                    id="job-title"
                    required
                    value={title}
                    onChange={setTitle}
                    options={JOB_TITLE_SUGGESTIONS}
                    placeholder="Search title or type your own…"
                    allowCustom
                    emptyLimit={30}
                  />
                </div>
                <div className="ev-span">
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
                </div>
                <div className="ev-span">
                  <CitySelect label="Location" required value={city} onChange={setCity} />
                </div>
                <div className="ev-span">
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
              <div className="ev-stack">
                <SelectField
                  label="Experience"
                  required
                  value={experience}
                  onChange={(value) => setExperience(value as (typeof JOB_EXPERIENCE_RANGES)[number])}
                  options={JOB_EXPERIENCE_RANGES.map((item) => ({ value: item, label: item }))}
                />
                <div>
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
                <SearchableCreatableSelect
                  label="Education"
                  id="education-min"
                  required
                  value={educationMin}
                  onChange={setEducationMin}
                  options={JOB_EDUCATION_LEVELS}
                  placeholder="Search degree or type your own…"
                  allowCustom
                />
                <fieldset className="ev-fieldset">
                  <legend className="ev-sub2">LANGUAGES</legend>
                  <div className="ev-chips2">
                    {PREFERRED_LANGUAGES.map((lang) => {
                      const active = languages.includes(lang);
                      return (
                        <button
                          key={lang}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            setLanguages((current) =>
                              active ? current.filter((item) => item !== lang) : [...current, lang],
                            )
                          }
                          className={`ev-chipbtn${active ? ' on' : ''}`}
                        >
                          {lang}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="ev-stack">
                <div className="ev-f ev-stack">
                  <Input
                    label="Salary from (₹ / month)"
                    name="salaryMin"
                    inputMode="numeric"
                    placeholder="18000"
                    required
                    error={salaryErrors.min}
                    value={salaryMin}
                    onChange={(event) => {
                      setSalaryMin(event.target.value.replace(/\D/g, ''));
                      setSalaryErrors((prev) => ({ ...prev, min: undefined }));
                    }}
                  />
                  <Input
                    label="Salary to (₹ / month)"
                    name="salaryMax"
                    inputMode="numeric"
                    placeholder="22000"
                    required
                    error={salaryErrors.max}
                    value={salaryMax}
                    onChange={(event) => {
                      setSalaryMax(event.target.value.replace(/\D/g, ''));
                      setSalaryErrors((prev) => ({ ...prev, max: undefined }));
                    }}
                  />
                </div>
                <Textarea
                  label="Job Description"
                  name="description"
                  required
                  maxLength={JOB_DESCRIPTION_MAX}
                  hint={`${description.length} / ${JOB_DESCRIPTION_MAX} characters`}
                  placeholder="Describe responsibilities, day-to-day work, and what success looks like…"
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, JOB_DESCRIPTION_MAX))}
                />
                <div>
                  <span className="ev-flabel">Benefits</span>
                  {benefits.length ? (
                    <ul className="ev-chips2" style={{ margin: '0 0 10px', padding: 0, listStyle: 'none' }}>
                      {benefits.map((item) => (
                        <li key={item} className="ev-sk">
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
                  <div className="ev-skadd">
                    <input
                      value={benefitDraft}
                      onChange={(e) => setBenefitDraft(e.target.value)}
                      aria-label="Add a benefit"
                      placeholder="e.g. Health insurance"
                      className="ev-input"
                    />
                    <button
                      type="button"
                      className="ev-btn ev-btn--ghost"
                      onClick={() => {
                        const next = benefitDraft.trim();
                        if (!next || benefits.includes(next)) return;
                        setBenefits((rows) => [...rows, next]);
                        setBenefitDraft('');
                      }}
                    >
                      + Add benefit
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div>
                <div className="ev-rvg">
                  <div className="ev-rvh">
                    <h2>Basics</h2>
                    <button type="button" className="ev-lnk" style={{ margin: 0 }} onClick={() => editStep(1)}>
                      Edit
                    </button>
                  </div>
                  <div className="ev-r2">
                    <span>Job title</span>
                    <b>{title || '—'}</b>
                  </div>
                  <div className="ev-r2">
                    <span>Department</span>
                    <b>{department || '—'}</b>
                  </div>
                  <div className="ev-r2">
                    <span>Location</span>
                    <b>{city || '—'}</b>
                  </div>
                  <div className="ev-r2">
                    <span>Job type</span>
                    <b>{JOB_TYPE_LABELS[jobType]}</b>
                  </div>
                </div>
                <div className="ev-rvg">
                  <div className="ev-rvh">
                    <h2>Requirements</h2>
                    <button type="button" className="ev-lnk" style={{ margin: 0 }} onClick={() => editStep(2)}>
                      Edit
                    </button>
                  </div>
                  <div className="ev-r2">
                    <span>Experience</span>
                    <b>{experience}</b>
                  </div>
                  <div className="ev-r2">
                    <span>Education</span>
                    <b>{educationMin || '—'}</b>
                  </div>
                  <div className="ev-r2">
                    <span>Skills</span>
                    <b>{skills.length ? skills.join(', ') : 'None added'}</b>
                  </div>
                  <div className="ev-r2">
                    <span>Languages</span>
                    <b>{languages.length ? languages.join(', ') : '—'}</b>
                  </div>
                </div>
                <div className="ev-rvg">
                  <div className="ev-rvh">
                    <h2>Details</h2>
                    <button type="button" className="ev-lnk" style={{ margin: 0 }} onClick={() => editStep(3)}>
                      Edit
                    </button>
                  </div>
                  <div className="ev-r2">
                    <span>Salary</span>
                    <b>
                      ₹{salaryMin || '0'} – ₹{salaryMax || '0'} / month
                    </b>
                  </div>
                  <div className="ev-r2">
                    <span>Benefits</span>
                    <b>{benefits.length ? benefits.join(', ') : '—'}</b>
                  </div>
                  <div className="ev-r2" style={{ display: 'block' }}>
                    <span>About the job</span>
                    <p style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', color: 'var(--ev-ink)' }}>
                      {description || '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="ev-mt">
                <EvAlert tone="error">{error}</EvAlert>
              </div>
            ) : null}

            <div className="ev-wnav">
              {step > 1 ? (
                <button type="button" className="ev-btn ev-btn--ghost" onClick={goBack}>
                  ← Back
                </button>
              ) : (
                <Link href="/employer/jobs" className="ev-btn ev-btn--ghost">
                  Cancel
                </Link>
              )}
              <small>
                Step {step} of {STEPS.length}
              </small>
              <span>
                {!isEditing ? (
                  <button
                    type="button"
                    className="ev-btn ev-btn--ghost"
                    disabled={draftSaving || loading}
                    onClick={() => void saveDraft()}
                  >
                    {draftSaving ? 'Saving…' : 'Save as draft'}
                  </button>
                ) : null}
                <button type="submit" className="ev-btn ev-btn--accent" disabled={loading || skillsBusy}>
                  {loading || skillsBusy
                    ? step === STEPS.length
                      ? isEditing
                        ? 'Saving…'
                        : 'Publishing…'
                      : 'Please wait…'
                    : step === STEPS.length
                      ? isEditing
                        ? 'Save job'
                        : 'Publish job'
                      : (
                          <span>
                            Next<span className="ev-hide-sm">: {STEPS[step].short}</span> →
                          </span>
                        )}
                </button>
              </span>
            </div>
          </form>
        </article>
      </div>
    </EmployerShellFallback>
  );
}
