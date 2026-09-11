'use client';

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/Input';
import { GroupedSelect } from '@/components/ui/GroupedSelect';
import { TECHNOLOGY_SKILLS } from '@/data/technology-skills';
import {
  EXPERIENCE_OPTIONS,
  JOB_FILTER_CHIPS,
  JOB_TYPE_OPTIONS,
  type JobFilterChip,
  type JobSearchFilterValues,
  type SalaryPeriod,
} from '@/features/jobs/job-search';

function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
            value === option.value
              ? 'bg-[#0a2e2c] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function FilterPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      {children}
    </div>
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
  const [manualSkill, setManualSkill] = useState('');
  const listedSkills = TECHNOLOGY_SKILLS.filter((skill) => !filters.skills.includes(skill));

  function addSkill(skill: string) {
    const next = skill.trim();
    if (!next || filters.skills.includes(next)) return;
    onChange({ skills: [...filters.skills, next] });
  }

  function removeSkill(skill: string) {
    onChange({ skills: filters.skills.filter((item) => item !== skill) });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-sm font-bold text-slate-800">Filters</p>
        <div className="flex flex-wrap gap-2">
          {JOB_FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => onToggleFilter(chip)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                activeFilter === chip
                  ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {activeFilter === 'Salary' ? (
        <FilterPanel title="Salary">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-3 sm:grid-cols-2">
              <Input
                label="From"
                name="salaryMin"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 15000"
                value={filters.salaryMin}
                onChange={(event) => onChange({ salaryMin: event.target.value })}
              />
              <Input
                label="To"
                name="salaryMax"
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="e.g. 30000"
                value={filters.salaryMax}
                onChange={(event) => onChange({ salaryMax: event.target.value })}
              />
            </div>
            <div className="shrink-0 space-y-1.5">
              <p className="text-xs font-bold text-slate-700">Period</p>
              <SegmentedToggle<SalaryPeriod>
                value={filters.salaryPeriod}
                options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'ctc', label: 'CTC' },
                ]}
                onChange={(salaryPeriod) => onChange({ salaryPeriod })}
              />
            </div>
          </div>
        </FilterPanel>
      ) : null}

      {activeFilter === 'Experience' ? (
        <FilterPanel title="Experience">
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange({
                    experience: filters.experience === option.value ? '' : option.value,
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  filters.experience === option.value
                    ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterPanel>
      ) : null}

      {activeFilter === 'Job Type' ? (
        <FilterPanel title="Job Type">
          <div className="flex flex-wrap gap-2">
            {JOB_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange({
                    jobType: filters.jobType === option.value ? '' : option.value,
                  })
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  filters.jobType === option.value
                    ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterPanel>
      ) : null}

      {activeFilter === 'Skills' ? (
        <FilterPanel title="Skills">
          <div className="space-y-3">
            <GroupedSelect
              id="job-skill"
              label="Select skill"
              value=""
              onChange={(skill) => {
                if (skill && listedSkills.includes(skill as (typeof TECHNOLOGY_SKILLS)[number])) {
                  addSkill(skill);
                }
              }}
              groups={[{ options: listedSkills }]}
              placeholder="Choose from list"
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Or enter skill manually"
                  name="manualSkill"
                  value={manualSkill}
                  onChange={(event) => setManualSkill(event.target.value)}
                  placeholder="Type a skill"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  addSkill(manualSkill);
                  setManualSkill('');
                }}
                className="rounded-xl border border-[#0a2e2c]/20 bg-white px-4 py-2.5 text-xs font-bold text-[#0a2e2c] hover:bg-slate-50 sm:mb-0.5"
              >
                Add skill
              </button>
            </div>
            {filters.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filters.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#ecfdf5] px-3 py-1 text-xs font-bold text-[#047857] ring-1 ring-[#a7f3d0]/80"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="text-[#047857]/70 hover:text-[#047857]"
                      aria-label={`Remove ${skill}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Pick one or more skills to narrow results.</p>
            )}
          </div>
        </FilterPanel>
      ) : null}
    </div>
  );
}
