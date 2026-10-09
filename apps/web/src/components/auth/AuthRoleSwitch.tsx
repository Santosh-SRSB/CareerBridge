'use client';

import type { LoginAccountType } from '@careerbridge/shared';

const OPTIONS = [
  { value: 'CANDIDATE', label: 'Candidate' },
  { value: 'EMPLOYER', label: 'Employer' },
] as const;

/** Candidate / employer switch for the login and registration screens. */
export function AuthRoleSwitch({
  value,
  onChange,
  label = 'Account type',
}: {
  value: LoginAccountType;
  onChange: (role: LoginAccountType) => void;
  label?: string;
}) {
  return (
    <div
      className="au-seg"
      role="group"
      aria-label={label}
      data-active={value === 'EMPLOYER' ? 'employer' : 'candidate'}
    >
      <span className="au-seg__pill" aria-hidden="true" />
      {OPTIONS.map(({ value: option, label: optionLabel }) => (
        <button
          key={option}
          type="button"
          className="au-seg__btn"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}
