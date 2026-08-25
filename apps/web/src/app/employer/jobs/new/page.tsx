'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  JOB_EDUCATION_LEVELS,
  JOB_EXPERIENCE_RANGES,
  JOB_SKILL_SUGGESTIONS,
  JOB_TYPES,
  WORK_MODES,
  salaryRangeError,
  type CreateJobPayload,
  type ScreeningQuestion,
  type ScreeningQuestionType,
} from '@careerbridge/shared';
import {
  createEmployerJob,
  publishEmployerJob,
  saveEmployerJobSkillProfile,
  updateEmployerJob,
} from '@/lib/api';
import { EmployerShellFallback } from '@/components/EmployerPortal';
import { BrandMascot } from '@/components/BrandMascot';
import { Input } from '@/components/ui/Input';
import { CitySelect } from '@/components/ui/CitySelect';
import { CategorySelect } from '@/components/ui/CategorySelect';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

const STEPS = [
  { id: 1, short: 'Basics', title: 'Post a New Job', subtitle: 'Name the role and where it sits in your team.' },
  { id: 2, short: 'Details', title: 'Job Details', subtitle: 'Location, work style, and compensation band.' },
  { id: 3, short: 'Fit', title: 'Requirements', subtitle: 'Skills and experience that define a strong match.' },
  { id: 4, short: 'Screen', title: 'Screening', subtitle: 'Must-have questions before someone applies.' },
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
  const cols =
    options.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-primary">{label}</legend>
      <div className={`grid gap-2 ${cols}`}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-2xl border px-3 py-3 text-sm font-bold transition duration-300 ease-out ${
                active
                  ? 'border-transparent bg-primary text-accent shadow-[0_10px_24px_rgba(10,46,44,0.22)]'
                  : 'border-primary/12 bg-white/80 text-primary hover:border-teal/40 hover:bg-white'
              }`}
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
        className="w-full rounded-2xl border border-primary/12 bg-white/90 px-3.5 py-3 text-base outline-none transition duration-200 ease-out focus:border-teal/50 focus:shadow-[0_0_0_3px_rgba(13,148,136,0.12)]"
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
  const [salaryMin, setSalaryMin] = useState('800000');
  const [salaryMax, setSalaryMax] = useState('1200000');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [draftJobId, setDraftJobId] = useState<string | null>(null);
  const [skillsBusy, setSkillsBusy] = useState(false);
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

  const current = STEPS[step - 1];
  const progressPct = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  function setDraftId(id: string) {
    draftJobIdRef.current = id;
    setDraftJobId(id);
  }

  function buildPayload(publish = false): CreateJobPayload {
    const trimmedDescription = description.trim();
    return {
      title: title.trim(),
      department: department.trim(),
      hiringManager: hiringManager.trim() || undefined,
      openings: Number(openings),
      category,
      city: city.trim(),
      workMode,
      jobType,
      experience,
      salaryMin: Number(salaryMin),
      salaryMax: Number(salaryMax),
      requiredSkills: skills,
      educationMin,
      description:
        trimmedDescription.length >= 20
          ? trimmedDescription
          : 'Draft job posting — requirements in progress.',
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

  const customSelectedSkills = skills.filter((skill) => !JOB_SKILL_SUGGESTIONS.includes(skill));

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
    if (!/^\d+$/.test(openings) || Number(openings) < 1) return 'Enter at least 1 opening.';
    if (category.trim().length < 2) return 'Select a job category.';
    if (nextStep <= 2) return null;
    if (city.trim().length < 2) return 'Select or enter the job location.';
    const salaryError = salaryRangeError(salaryMin, salaryMax);
    if (salaryError) return salaryError;
    if (nextStep <= 3) return null;
    if (!skills.length) return 'Select at least one required skill.';
    if (description.trim().length < 20) return 'Add a job description of at least 20 characters.';
    if (nextStep <= 4) return null;
    for (const question of questions) {
      if (question.prompt.trim().length < 3) return 'Each screening question needs a clear prompt.';
      if (question.type === 'SINGLE_CHOICE' && (question.options || []).filter(Boolean).length < 2) {
        return 'Choice questions need at least 2 options.';
      }
    }
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

  return (
    <EmployerShellFallback>
      <section className="cb-job-wizard cb-employer-page relative z-10 overflow-visible">
        <div className="cb-job-wizard__stage grid overflow-visible lg:grid-cols-[200px_minmax(0,1fr)]">
          <aside className="cb-job-wizard__rail hidden lg:flex">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#eab308]/90">
              Job studio
            </p>
            <ol className="mt-6 flex flex-1 flex-col gap-1">
              {STEPS.map((item, index) => {
                const active = item.id === step;
                const done = item.id < step;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id < step) {
                          setError('');
                          setStep(item.id);
                        }
                      }}
                      className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition duration-300 ease-out ${
                        active
                          ? 'bg-white/12 text-white'
                          : done
                            ? 'text-white/85 hover:bg-white/8'
                            : 'text-white/45'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition duration-300 ${
                          active
                            ? 'bg-[#eab308] text-navy shadow-[0_8px_20px_rgba(234,179,8,0.35)]'
                            : done
                              ? 'bg-teal/40 text-white'
                              : 'border border-white/25 text-white/60'
                        }`}
                      >
                        {done ? '✓' : index + 1}
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{item.short}</span>
                        <span className="block text-[11px] text-white/55">{item.title}</span>
                      </span>
                    </button>
                    {index < STEPS.length - 1 ? (
                      <span className="ml-7 block h-3 w-px bg-white/15" aria-hidden />
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <div className="mt-auto pt-6">
              <BrandMascot pose="laptop" motion="float" size="sm" className="opacity-95" />
            </div>
          </aside>

          <div className="cb-job-wizard__panel relative z-20 overflow-visible p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-primary/8 pb-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal">
                  Step {step} of {STEPS.length}
                  <span className="mx-2 text-primary/20">·</span>
                  <span className="text-muted">{current.short}</span>
                </p>
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-[2rem]">
                  {current.title}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted sm:text-base">{current.subtitle}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden h-12 w-12 overflow-hidden sm:block md:hidden">
                  <BrandMascot pose="checklist" motion="none" size="sm" />
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Progress</p>
                  <p className="text-2xl font-extrabold tabular-nums text-primary">{progressPct}%</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-1.5 lg:hidden">
              {STEPS.map((item) => (
                <span
                  key={item.id}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-500 ease-out ${
                    item.id <= step ? 'bg-gradient-to-r from-[#ca8a04] to-[#eab308]' : 'bg-primary-soft'
                  }`}
                />
              ))}
            </div>

            <form
              key={step}
              onSubmit={(event) => {
                event.preventDefault();
                if (step < STEPS.length) goNext();
                else void onSubmit(event);
              }}
              className="cb-job-wizard__form relative z-30 mt-6 space-y-5"
            >
              {step === 1 ? (
                <div className="space-y-4">
                  <div className="cb-job-wizard__block grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Input
                        label="Job Title"
                        name="title"
                        required
                        placeholder="Software Developer"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                      />
                    </div>
                    <Input
                      label="Department"
                      name="department"
                      required
                      placeholder="Engineering"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                    />
                    <Input
                      label="Number of Openings"
                      name="openings"
                      required
                      inputMode="numeric"
                      placeholder="3"
                      value={openings}
                      onChange={(event) => setOpenings(event.target.value.replace(/\D/g, ''))}
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Hiring Manager"
                        name="hiringManager"
                        placeholder="Select Manager (optional)"
                        value={hiringManager}
                        onChange={(event) => setHiringManager(event.target.value)}
                        hint="Optional for now — useful when multiple recruiters share one company account."
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <CategorySelect required value={category} onChange={setCategory} />
                    </div>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <CitySelect label="Location" required value={city} onChange={setCity} />
                  <ChoiceGrid
                    label="Work Mode"
                    value={workMode}
                    onChange={(value) => setWorkMode(value as (typeof WORK_MODES)[number])}
                    options={WORK_MODES.map((mode) => ({ value: mode, label: WORK_MODE_LABELS[mode] }))}
                  />
                  <ChoiceGrid
                    label="Employment Type"
                    value={jobType}
                    onChange={(value) => setJobType(value as (typeof JOB_TYPES)[number])}
                    options={JOB_TYPES.map((type) => ({ value: type, label: JOB_TYPE_LABELS[type] }))}
                  />
                  <SelectField
                    label="Experience"
                    required
                    value={experience}
                    onChange={(value) => setExperience(value as (typeof JOB_EXPERIENCE_RANGES)[number])}
                    options={JOB_EXPERIENCE_RANGES.map((item) => ({ value: item, label: item }))}
                  />
                  <div className="cb-job-wizard__block grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Salary / CTC from (₹ / year)"
                      name="salaryMin"
                      inputMode="numeric"
                      placeholder="800000"
                      value={salaryMin}
                      onChange={(event) => setSalaryMin(event.target.value.replace(/\D/g, ''))}
                    />
                    <Input
                      label="Salary / CTC to (₹ / year)"
                      name="salaryMax"
                      inputMode="numeric"
                      placeholder="1200000"
                      value={salaryMax}
                      onChange={(event) => setSalaryMax(event.target.value.replace(/\D/g, ''))}
                    />
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <div className="cb-job-wizard__block">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-primary">Required Skills</p>
                      {skillsBusy ? (
                        <p className="text-xs font-semibold text-teal">Saving to job…</p>
                      ) : draftJobId ? (
                        <p className="text-xs font-medium text-muted">Synced with job draft</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {JOB_SKILL_SUGGESTIONS.map((item) => {
                        const active = skills.includes(item);
                        return (
                          <span
                            key={item}
                            className={`inline-flex items-center gap-1 rounded-full border pl-3.5 text-sm font-semibold transition duration-300 ease-out ${
                              active
                                ? 'border-transparent bg-primary text-accent shadow-[0_8px_18px_rgba(10,46,44,0.2)]'
                                : 'border-primary/15 bg-white text-primary hover:border-teal/45'
                            }`}
                          >
                            <button
                              type="button"
                              disabled={skillsBusy}
                              onClick={() => toggleSkill(item)}
                              className={`py-2 ${active ? 'pr-1' : 'pr-3.5'} disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              {item}
                            </button>
                            {active ? (
                              <button
                                type="button"
                                disabled={skillsBusy}
                                aria-label={`Remove ${item}`}
                                title="Remove"
                                onClick={() => removeSkill(item)}
                                className="mr-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm leading-none text-accent/90 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                ×
                              </button>
                            ) : null}
                          </span>
                        );
                      })}
                      {customSelectedSkills.map((item) => (
                        <span
                          key={`custom-${item}`}
                          className="inline-flex items-center gap-1 rounded-full border border-transparent bg-primary pl-3.5 text-sm font-semibold text-accent shadow-[0_8px_18px_rgba(10,46,44,0.2)]"
                        >
                          <span className="py-2 pr-1">{item}</span>
                          <button
                            type="button"
                            disabled={skillsBusy}
                            aria-label={`Remove ${item}`}
                            title="Remove"
                            onClick={() => removeSkill(item)}
                            className="mr-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm leading-none text-accent/90 hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={customSkill}
                        onChange={(event) => setCustomSkill(event.target.value)}
                        placeholder="Add a custom skill"
                        className="min-w-0 flex-1 rounded-2xl border border-primary/12 bg-white/90 px-3 py-2.5 text-sm outline-none focus:border-teal/50"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        block={false}
                        size="md"
                        disabled={skillsBusy}
                        onClick={addCustomSkill}
                        className="!rounded-2xl"
                      >
                        Add
                      </Button>
                    </div>
                    {skills.length ? (
                      <p className="mt-2 text-xs text-muted">Selected: {skills.join(', ')}</p>
                    ) : null}
                  </div>
                  <SelectField
                    label="Minimum Education"
                    required
                    value={educationMin}
                    onChange={(value) => setEducationMin(value as (typeof JOB_EDUCATION_LEVELS)[number])}
                    options={JOB_EDUCATION_LEVELS.map((item) => ({ value: item, label: item }))}
                  />
                  <Textarea
                    label="Job Description"
                    name="description"
                    required
                    placeholder="Build scalable web applications, APIs and collaborate with cross-functional teams..."
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>
              ) : null}

              {step === 4 ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#eab308]/35 bg-gradient-to-br from-[#fff8e7] to-white px-4 py-3 text-sm text-primary">
                    Screening questions are optional, but help filter candidates like Naukri must-haves.
                    Candidates answer these when they apply.
                  </div>
                  {questions.map((question, index) => (
                    <div
                      key={question.id}
                      className="cb-job-wizard__block relative overflow-visible rounded-2xl border border-primary/10 bg-white/90 p-4 shadow-[0_8px_24px_rgba(10,46,44,0.04)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-bold text-primary">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-accent">
                            {index + 1}
                          </span>
                          Question {index + 1}
                        </p>
                        <button
                          type="button"
                          className="text-sm font-semibold text-error transition hover:opacity-80"
                          onClick={() => removeQuestion(question.id)}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 space-y-3">
                        <Input
                          label="Prompt"
                          name={`prompt-${question.id}`}
                          placeholder="e.g. Are you willing to relocate?"
                          value={question.prompt}
                          onChange={(event) => updateQuestion(question.id, { prompt: event.target.value })}
                        />
                        <SelectField
                          label="Answer type"
                          value={question.type}
                          onChange={(value) =>
                            updateQuestion(question.id, {
                              type: value as ScreeningQuestionType,
                              options:
                                value === 'SINGLE_CHOICE'
                                  ? question.options?.length
                                    ? question.options
                                    : ['Option 1', 'Option 2']
                                  : [],
                            })
                          }
                          options={[
                            { value: 'YES_NO', label: 'Yes / No' },
                            { value: 'SHORT_TEXT', label: 'Short text' },
                            { value: 'SINGLE_CHOICE', label: 'Single choice' },
                          ]}
                        />
                        {question.type === 'SINGLE_CHOICE' ? (
                          <Input
                            label="Choices (comma separated)"
                            name={`options-${question.id}`}
                            placeholder="Immediate, 15 days, 30 days, 60 days"
                            value={(question.options || []).join(', ')}
                            onChange={(event) =>
                              updateQuestion(question.id, {
                                options: event.target.value
                                  .split(',')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        ) : null}
                        <label className="flex items-center gap-2 text-sm text-primary">
                          <input
                            type="checkbox"
                            checked={question.required !== false}
                            onChange={(event) =>
                              updateQuestion(question.id, { required: event.target.checked })
                            }
                          />
                          Required
                        </label>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" onClick={addQuestion} className="!rounded-2xl">
                    + Add screening question
                  </Button>
                </div>
              ) : null}

              {error ? (
                <p className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-primary/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
                {step > 1 ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={goBack}
                    block={false}
                    className="!rounded-full !px-6"
                  >
                    Back
                  </Button>
                ) : (
                  <span className="hidden text-sm text-muted sm:inline">Ready when you are.</span>
                )}
                <Button
                  type="submit"
                  loading={loading}
                  loadingLabel={step === STEPS.length ? 'Publishing...' : 'Please wait...'}
                  block={false}
                  className="cb-btn-shimmer !rounded-full !bg-gradient-to-r !from-[#0a2e2c] !to-[#134e4a] !px-8 !text-white"
                >
                  {step === STEPS.length ? 'Publish Job' : 'Continue'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </EmployerShellFallback>
  );
}
