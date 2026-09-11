'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { INDIA_STATES, getCitiesForState } from '@/data/india-locations';
import {
  EXPERIENCE_OPTIONS,
  JOB_TYPE_OPTIONS,
  type JobSearchFilterValues,
  type SalaryPeriod,
} from '@/features/jobs/job-search';

const SALARY_SLIDER_MIN = 0;
const SALARY_MONTHLY_MAX = 200_000;
const SALARY_CTC_MAX = 2_400_000;
const SALARY_STEP_MONTHLY = 5_000;
const SALARY_STEP_CTC = 50_000;

/** Decorative histogram heights (relative) for salary distribution look. */
const SALARY_HISTOGRAM = [
  18, 22, 28, 36, 48, 58, 72, 80, 88, 92, 86, 78, 70, 62, 54, 46, 38, 30, 24, 18, 14, 10, 8, 6,
];

const POPULAR_SKILLS = [
  'Sales',
  'React',
  'JavaScript',
  'Python',
  'Java',
  'Excel',
  'Communication',
  'Customer Support',
  'SQL',
  'Node.js',
] as const;

const POPULAR_CITIES = [
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Noida', state: 'Uttar Pradesh' },
  { city: 'Gurgaon', state: 'Haryana' },
] as const;

function salaryCeiling(period: SalaryPeriod) {
  return period === 'ctc' ? SALARY_CTC_MAX : SALARY_MONTHLY_MAX;
}

function salaryStep(period: SalaryPeriod) {
  return period === 'ctc' ? SALARY_STEP_CTC : SALARY_STEP_MONTHLY;
}

function formatSalaryLabel(value: number, period: SalaryPeriod) {
  const ceiling = salaryCeiling(period);
  if (value >= ceiling) {
    return period === 'ctc' ? '₹24,00,000+' : '₹2,00,000+';
  }
  return `₹${value.toLocaleString('en-IN')}`;
}

function Chip({
  label,
  active,
  onClick,
  square,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  square?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border text-sm font-semibold transition ${
        square
          ? 'min-w-[3rem] rounded-lg px-3 py-2.5'
          : 'rounded-lg px-3.5 py-2.5'
      } ${
        active
          ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white'
          : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
      }`}
    >
      {label}
    </button>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-base font-bold text-slate-700">{children}</h3>;
}

function SalaryRangeSlider({
  min,
  max,
  period,
  onChange,
}: {
  min: number;
  max: number;
  period: SalaryPeriod;
  onChange: (patch: Partial<JobSearchFilterValues>) => void;
}) {
  const ceiling = salaryCeiling(period);
  const step = salaryStep(period);
  const lo = Math.min(Math.max(min, SALARY_SLIDER_MIN), ceiling);
  const hi = Math.min(Math.max(max, lo), ceiling);
  const leftPct = (lo / ceiling) * 100;
  const rightPct = (hi / ceiling) * 100;

  function setMin(next: number) {
    const clamped = Math.min(Math.max(SALARY_SLIDER_MIN, next), hi);
    onChange({ salaryMin: String(clamped) });
  }

  function setMax(next: number) {
    const clamped = Math.max(Math.min(ceiling, next), lo);
    onChange({ salaryMax: String(clamped) });
  }

  function switchPeriod(next: SalaryPeriod) {
    if (next === period) return;
    if (next === 'ctc') {
      onChange({
        salaryPeriod: next,
        salaryMin: String(Math.min(lo * 12, SALARY_CTC_MAX)),
        salaryMax: String(Math.min(hi * 12, SALARY_CTC_MAX)),
      });
      return;
    }
    onChange({
      salaryPeriod: next,
      salaryMin: String(Math.min(Math.round(lo / 12), SALARY_MONTHLY_MAX)),
      salaryMax: String(Math.min(Math.round(hi / 12), SALARY_MONTHLY_MAX)),
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle>Salary</SectionTitle>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(
            [
              { value: 'monthly', label: 'Monthly' },
              { value: 'ctc', label: 'CTC' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => switchPeriod(option.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
                period === option.value
                  ? 'bg-[#0a2e2c] text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex h-12 items-end gap-0.5 px-1" aria-hidden>
        {SALARY_HISTOGRAM.map((height, index) => {
          const barPct = (index / (SALARY_HISTOGRAM.length - 1)) * 100;
          const inRange = barPct >= leftPct && barPct <= rightPct;
          return (
            <div
              key={index}
              className={`flex-1 rounded-t-sm transition-colors ${
                inRange ? 'bg-[#0a2e2c]/35' : 'bg-slate-200'
              }`}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      <div className="relative h-8">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#0a2e2c]"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <input
          type="range"
          min={SALARY_SLIDER_MIN}
          max={ceiling}
          step={step}
          value={lo}
          onChange={(event) => setMin(Number(event.target.value))}
          className="jobs-salary-thumb absolute inset-0 z-20 w-full appearance-none bg-transparent"
          aria-label="Minimum salary"
        />
        <input
          type="range"
          min={SALARY_SLIDER_MIN}
          max={ceiling}
          step={step}
          value={hi}
          onChange={(event) => setMax(Number(event.target.value))}
          className="jobs-salary-thumb absolute inset-0 z-30 w-full appearance-none bg-transparent"
          aria-label="Maximum salary"
        />
      </div>

      <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
        <span>{formatSalaryLabel(lo, period)}</span>
        <span>{formatSalaryLabel(hi, period)}</span>
      </div>
    </div>
  );
}

export function JobsOlxFilters({
  filters,
  onChange,
}: {
  filters: JobSearchFilterValues;
  onChange: (patch: Partial<JobSearchFilterValues>) => void;
}) {
  const [locationQuery, setLocationQuery] = useState(
    filters.city || filters.state || '',
  );
  const [skillQuery, setSkillQuery] = useState('');

  const salaryMinNum = Number(filters.salaryMin) || SALARY_SLIDER_MIN;
  const salaryMaxNum =
    Number(filters.salaryMax) || salaryCeiling(filters.salaryPeriod);

  const locationSuggestions = useMemo(() => {
    const q = locationQuery.trim().toLowerCase();
    if (q.length < 2) return [];

    const matches: { city: string; state: string }[] = [];
    for (const state of INDIA_STATES) {
      if (state.toLowerCase().includes(q)) {
        matches.push({ city: '', state });
      }
      for (const city of getCitiesForState(state)) {
        if (city.toLowerCase().includes(q)) {
          matches.push({ city, state });
        }
        if (matches.length >= 12) return matches;
      }
      if (matches.length >= 12) break;
    }
    return matches;
  }, [locationQuery]);

  function selectLocation(city: string, state: string) {
    onChange({ state, city });
    setLocationQuery(city || state);
  }

  function clearLocation() {
    onChange({ state: '', city: '' });
    setLocationQuery('');
  }

  function toggleSkill(skill: string) {
    const exists = filters.skills.includes(skill);
    onChange({
      skills: exists
        ? filters.skills.filter((item) => item !== skill)
        : [...filters.skills, skill],
    });
  }

  function addSkillFromQuery() {
    const next = skillQuery.trim();
    if (!next || filters.skills.includes(next)) return;
    onChange({ skills: [...filters.skills, next] });
    setSkillQuery('');
  }

  return (
    <div className="space-y-8">
      <div>
        <label className="mb-2 block text-base font-bold text-slate-800" htmlFor="jobs-q">
          Job title / skill
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
          </span>
          <input
            id="jobs-q"
            name="q"
            value={filters.q}
            onChange={(event) => onChange({ q: event.target.value })}
            placeholder="e.g. Sales, React, Fresher"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/15"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-lg font-extrabold text-slate-900">Select Location</h3>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z"
              />
            </svg>
          </span>
          <input
            value={locationQuery}
            onChange={(event) => setLocationQuery(event.target.value)}
            placeholder="City or state"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-10 text-sm font-medium text-slate-900 outline-none focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/15"
            aria-label="Search location"
          />
          {locationQuery ? (
            <button
              type="button"
              onClick={clearLocation}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
              aria-label="Clear location"
            >
              ×
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Select cities or states across India to find nearby jobs.
        </p>

        {filters.state || filters.city ? (
          <p className="mt-2 text-sm font-semibold text-[#0a2e2c]">
            {[filters.city, filters.state].filter(Boolean).join(', ')}
          </p>
        ) : null}

        {locationSuggestions.length > 0 ? (
          <ul className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {locationSuggestions.map((item) => {
              const key = `${item.state}-${item.city || 'all'}`;
              const label = item.city ? `${item.city}, ${item.state}` : item.state;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => selectLocation(item.city, item.state)}
                    className="w-full px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULAR_CITIES.map((item) => (
              <Chip
                key={item.city}
                label={item.city}
                active={filters.city === item.city}
                onClick={() => selectLocation(item.city, item.state)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle>Job Type</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              active={filters.jobType === option.value}
              onClick={() =>
                onChange({
                  jobType: filters.jobType === option.value ? '' : option.value,
                })
              }
            />
          ))}
        </div>
      </div>

      <div>
        <SectionTitle>Experience</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              square
              active={filters.experience === option.value}
              onClick={() =>
                onChange({
                  experience: filters.experience === option.value ? '' : option.value,
                })
              }
            />
          ))}
        </div>
      </div>

      <SalaryRangeSlider
        min={salaryMinNum}
        max={salaryMaxNum}
        period={filters.salaryPeriod}
        onChange={onChange}
      />

      <div>
        <SectionTitle>Skills</SectionTitle>
        <div className="mb-3 flex gap-2">
          <input
            value={skillQuery}
            onChange={(event) => setSkillQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addSkillFromQuery();
              }
            }}
            placeholder="Add a skill"
            className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium outline-none focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/15"
          />
          <button
            type="button"
            onClick={addSkillFromQuery}
            className="shrink-0 rounded-xl border border-[#0a2e2c]/25 bg-white px-4 py-2.5 text-sm font-bold text-[#0a2e2c] hover:bg-slate-50"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR_SKILLS.map((skill) => (
            <Chip
              key={skill}
              label={skill}
              active={filters.skills.includes(skill)}
              onClick={() => toggleSkill(skill)}
            />
          ))}
          {filters.skills
            .filter((skill) => !(POPULAR_SKILLS as readonly string[]).includes(skill))
            .map((skill) => (
              <Chip key={skill} label={skill} active onClick={() => toggleSkill(skill)} />
            ))}
        </div>
      </div>
    </div>
  );
}
