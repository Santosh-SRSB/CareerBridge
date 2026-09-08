'use client';

import type { AccountKind, LoginAccountType } from '@careerbridge/shared';

function SegmentToggle({
  options,
  value,
  onChange,
  labels,
}: {
  options: LoginAccountType[];
  value: LoginAccountType;
  onChange: (role: LoginAccountType) => void;
  labels: Record<string, string>;
}) {
  const index = Math.max(0, options.indexOf(value));
  const cols = options.length;
  const activeInRow = options.includes(value);

  return (
    <div
      className="relative rounded-xl bg-[#eef4f1] p-1 border border-primary/10 shadow-inner"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {activeInRow ? (
        <span
          className="absolute inset-y-1 left-1 rounded-lg bg-primary shadow-sm transition-transform duration-300 ease-out"
          style={{
            width: `calc(${100 / cols}% - 2px)`,
            transform: `translateX(${index * 100}%)`,
          }}
        />
      ) : null}
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          suppressHydrationWarning
          className={`relative z-10 rounded-lg py-2 text-xs font-bold transition-colors duration-200 ${
            value === option ? 'text-white' : 'text-primary/70 hover:text-primary'
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

export function RoleToggle({
  value,
  onChange,
  includeStaff = false,
}: {
  value: LoginAccountType;
  onChange: (role: LoginAccountType) => void;
  includeStaff?: boolean;
}) {
  return (
    <SegmentToggle
      options={['CANDIDATE', 'EMPLOYER']}
      value={value === 'SUPER_ADMIN' || value === 'ADMIN' ? 'CANDIDATE' : value}
      onChange={onChange}
      labels={{ CANDIDATE: 'Candidate', EMPLOYER: 'Employer' }}
    />
  );
}

export function parseAccountKind(value: string | null | undefined): AccountKind {
  return value?.toUpperCase() === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
}

export function parseLoginAccountType(value: string | null | undefined): LoginAccountType {
  const raw = value?.toUpperCase();
  if (raw === 'EMPLOYER') return 'EMPLOYER';
  if (raw === 'SUPER_ADMIN' || raw === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (raw === 'ADMIN' || raw === 'PLATFORM') return 'ADMIN';
  return 'CANDIDATE';
}
