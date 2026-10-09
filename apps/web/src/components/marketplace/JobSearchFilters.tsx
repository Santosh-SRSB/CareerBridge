'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TECHNOLOGY_SKILLS } from '@/data/technology-skills';
import {
  EXPERIENCE_OPTIONS,
  JOB_FILTER_CHIPS,
  JOB_TYPE_OPTIONS,
  type JobFilterChip,
  type JobSearchFilterValues,
  type SalaryPeriod,
} from '@/features/jobs/job-search';

/** Preset CTC bands in rupees per year; they fill the same min/max fields as the custom range. */
const SALARY_BANDS = [
  { id: '0-2', label: '0–2 LPA', min: '', max: '200000' },
  { id: '2-4', label: '2–4 LPA', min: '200000', max: '400000' },
  { id: '4-6', label: '4–6 LPA', min: '400000', max: '600000' },
  { id: '6-10', label: '6–10 LPA', min: '600000', max: '1000000' },
  { id: '10+', label: '10+ LPA', min: '1000000', max: '' },
] as const;

function activeBand(filters: JobSearchFilterValues) {
  if (filters.salaryPeriod !== 'ctc') return null;
  return (
    SALARY_BANDS.find(
      (band) => band.min === filters.salaryMin.trim() && band.max === filters.salaryMax.trim(),
    ) || null
  );
}

function salarySummary(filters: JobSearchFilterValues) {
  const band = activeBand(filters);
  if (band) return band.label;
  const min = filters.salaryMin.trim();
  const max = filters.salaryMax.trim();
  if (!min && !max) return '';
  const unit = filters.salaryPeriod === 'monthly' ? '/month' : ' CTC';
  if (min && max) return `₹${min}–${max}${unit}`;
  return min ? `From ₹${min}${unit}` : `Up to ₹${max}${unit}`;
}

function ChevronIcon() {
  return (
    <svg className="jb-ic jb-ic--sm jb-fchev" viewBox="0 0 24 24" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function OptionRow({
  type,
  name,
  checked,
  onChange,
  children,
}: {
  type: 'radio' | 'checkbox';
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="jb-orow">
      <input type={type} name={name} checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

export function JobSearchFilters({
  activeFilter,
  onToggleFilter,
  filters,
  onChange,
}: {
  /** Only one filter panel open at a time — clicking another replaces this. */
  activeFilter: JobFilterChip | null;
  onToggleFilter: (chip: JobFilterChip) => void;
  filters: JobSearchFilterValues;
  onChange: (patch: Partial<JobSearchFilterValues>) => void;
}) {
  const [skillQuery, setSkillQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Partial<Record<JobFilterChip, HTMLButtonElement | null>>>({});

  function closePanel(focusButton: boolean) {
    if (!activeFilter) return;
    const btn = buttonRefs.current[activeFilter];
    setSkillQuery('');
    onToggleFilter(activeFilter);
    if (focusButton) btn?.focus();
  }

  useEffect(() => {
    if (!activeFilter) return;
    function onDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setSkillQuery('');
      onToggleFilter(activeFilter!);
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      const btn = buttonRefs.current[activeFilter!];
      setSkillQuery('');
      onToggleFilter(activeFilter!);
      btn?.focus();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [activeFilter, onToggleFilter]);

  function selectedCount(chip: JobFilterChip) {
    if (chip === 'Salary') return filters.salaryMin.trim() || filters.salaryMax.trim() ? 1 : 0;
    if (chip === 'Experience') return filters.experience ? 1 : 0;
    if (chip === 'Job Type') return filters.jobType ? 1 : 0;
    return filters.skills.length;
  }

  function toggleSkill(skill: string) {
    const next = skill.trim();
    if (!next) return;
    onChange({
      skills: filters.skills.includes(next)
        ? filters.skills.filter((item) => item !== next)
        : [...filters.skills, next],
    });
  }

  const band = activeBand(filters);
  const q = skillQuery.trim().toLowerCase();
  const customSkills = filters.skills.filter(
    (skill) => !(TECHNOLOGY_SKILLS as readonly string[]).includes(skill),
  );
  const skillOptions = [...customSkills, ...TECHNOLOGY_SKILLS].filter(
    (skill) => !q || skill.toLowerCase().includes(q),
  );
  const exactSkill = [...customSkills, ...TECHNOLOGY_SKILLS].some(
    (skill) => skill.toLowerCase() === q,
  );

  function panelBody(chip: JobFilterChip) {
    if (chip === 'Salary') {
      return (
        <>
          <div className="jb-pl" role="group" aria-label="Salary range">
            <OptionRow
              type="radio"
              name="jb-salary"
              checked={!filters.salaryMin.trim() && !filters.salaryMax.trim()}
              onChange={() => onChange({ salaryMin: '', salaryMax: '' })}
            >
              Any salary
            </OptionRow>
            {SALARY_BANDS.map((item) => (
              <OptionRow
                key={item.id}
                type="radio"
                name="jb-salary"
                checked={band?.id === item.id}
                onChange={() => onChange({ salaryMin: item.min, salaryMax: item.max, salaryPeriod: 'ctc' })}
              >
                {item.label}
              </OptionRow>
            ))}
          </div>
          <div className="jb-pop-custom">
            <p className="jb-pop-cap">Custom range</p>
            <div className="jb-seg" role="group" aria-label="Salary period">
              {(
                [
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'ctc', label: 'CTC' },
                ] as { value: SalaryPeriod; label: string }[]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filters.salaryPeriod === option.value}
                  onClick={() => onChange({ salaryPeriod: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="jb-pop-range">
              <label>
                <span>From</span>
                <input
                  name="salaryMin"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="e.g. 15000"
                  value={filters.salaryMin}
                  onChange={(event) => onChange({ salaryMin: event.target.value })}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  name="salaryMax"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="e.g. 30000"
                  value={filters.salaryMax}
                  onChange={(event) => onChange({ salaryMax: event.target.value })}
                />
              </label>
            </div>
          </div>
        </>
      );
    }

    if (chip === 'Experience') {
      return (
        <div className="jb-pl" role="group" aria-label="Experience">
          <OptionRow
            type="radio"
            name="jb-experience"
            checked={!filters.experience}
            onChange={() => onChange({ experience: '' })}
          >
            Any experience
          </OptionRow>
          {EXPERIENCE_OPTIONS.map((option) => (
            <OptionRow
              key={option.value}
              type="radio"
              name="jb-experience"
              checked={filters.experience === option.value}
              onChange={() => onChange({ experience: option.value })}
            >
              {option.label}
            </OptionRow>
          ))}
        </div>
      );
    }

    if (chip === 'Job Type') {
      return (
        <div className="jb-pl" role="group" aria-label="Job type">
          <OptionRow
            type="radio"
            name="jb-jobtype"
            checked={!filters.jobType}
            onChange={() => onChange({ jobType: '' })}
          >
            Any job type
          </OptionRow>
          {JOB_TYPE_OPTIONS.map((option) => (
            <OptionRow
              key={option.value}
              type="radio"
              name="jb-jobtype"
              checked={filters.jobType === option.value}
              onChange={() => onChange({ jobType: option.value })}
            >
              {option.label}
            </OptionRow>
          ))}
        </div>
      );
    }

    return (
      <>
        <div className="jb-psearch">
          <svg className="jb-ic jb-ic--sm" viewBox="0 0 24 24" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={skillQuery}
            onChange={(event) => setSkillQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (skillQuery.trim() && !exactSkill) {
                  toggleSkill(skillQuery);
                  setSkillQuery('');
                }
              }
            }}
            placeholder="Search skills..."
            aria-label="Search skills"
            autoComplete="off"
          />
        </div>
        <div className="jb-pl jb-pl--scroll" role="group" aria-label="Skills">
          {skillQuery.trim() && !exactSkill ? (
            <button
              type="button"
              className="jb-orow jb-orow--add"
              onClick={() => {
                toggleSkill(skillQuery);
                setSkillQuery('');
              }}
            >
              + Add &ldquo;{skillQuery.trim()}&rdquo;
            </button>
          ) : null}
          {skillOptions.map((skill) => (
            <OptionRow
              key={skill}
              type="checkbox"
              name="jb-skill"
              checked={filters.skills.includes(skill)}
              onChange={() => toggleSkill(skill)}
            >
              {skill}
            </OptionRow>
          ))}
          {!skillOptions.length && !skillQuery.trim() ? <p className="jb-pop-note">No matches</p> : null}
        </div>
      </>
    );
  }

  const active: { key: string; label: string; clear: () => void }[] = [];
  const salaryText = salarySummary(filters);
  if (salaryText) {
    active.push({ key: 'salary', label: `Salary: ${salaryText}`, clear: () => onChange({ salaryMin: '', salaryMax: '' }) });
  }
  if (filters.experience) {
    const label = EXPERIENCE_OPTIONS.find((o) => o.value === filters.experience)?.label || filters.experience;
    active.push({ key: 'experience', label: `Experience: ${label}`, clear: () => onChange({ experience: '' }) });
  }
  if (filters.jobType) {
    const label = JOB_TYPE_OPTIONS.find((o) => o.value === filters.jobType)?.label || filters.jobType;
    active.push({ key: 'jobType', label, clear: () => onChange({ jobType: '' }) });
  }
  for (const skill of filters.skills) {
    active.push({ key: `skill-${skill}`, label: `Skill: ${skill}`, clear: () => toggleSkill(skill) });
  }

  return (
    <div ref={rootRef}>
      <h2 className="jb-sec-t">Filters</h2>
      <div className="jb-filters">
        {JOB_FILTER_CHIPS.map((chip) => {
          const open = activeFilter === chip;
          const count = selectedCount(chip);
          const panelId = `jb-filter-${chip.replace(/\s+/g, '-').toLowerCase()}`;
          return (
            <div key={chip} className="jb-fwrap">
              <button
                ref={(el) => {
                  buttonRefs.current[chip] = el;
                }}
                type="button"
                onClick={() => {
                  setSkillQuery('');
                  onToggleFilter(chip);
                }}
                aria-expanded={open}
                aria-haspopup="dialog"
                aria-controls={open ? panelId : undefined}
                className={count ? 'jb-fbtn jb-fbtn--has' : 'jb-fbtn'}
              >
                {chip}
                {count ? (
                  <span className="jb-fbtn-n">
                    <span className="sr-only">selected: </span>
                    {count}
                  </span>
                ) : null}
                <ChevronIcon />
              </button>
              {open ? (
                <>
                  <div className="jb-pop-back" aria-hidden onClick={() => closePanel(true)} />
                  <div className="jb-pop" id={panelId} role="dialog" aria-label={`${chip} filter`}>
                    <div className="jb-pop-h">
                      <strong>{chip}</strong>
                      <button type="button" className="jb-btn jb-btn--sm" onClick={() => closePanel(true)}>
                        Done
                      </button>
                    </div>
                    {panelBody(chip)}
                    {chip === 'Salary' || chip === 'Experience' || chip === 'Job Type' ? (
                      <p className="jb-pop-note">Select one.</p>
                    ) : (
                      <p className="jb-pop-note">Select one or more.</p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {active.length ? (
        <ul className="jb-active" aria-label="Selected filters">
          {active.map((item) => (
            <li key={item.key} className="jb-chip jb-chip--line">
              <span>{item.label}</span>
              <button type="button" onClick={item.clear} aria-label={`Remove filter ${item.label}`}>
                <svg className="jb-ic jb-ic--sm" viewBox="0 0 24 24" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
