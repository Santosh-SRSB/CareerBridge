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
      className="relative rounded-xl bg-[#eef0ff] p-1 border border-[#e5e7f2] shadow-inner"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {activeInRow ? (
        <span
          className="absolute inset-y-1 left-1 rounded-lg bg-[#0b0e5e] shadow-sm transition-transform duration-300 ease-out"
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
            value === option ? 'text-white' : 'text-[#4b4f8f] hover:text-[#0b0e5e]'
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
}: {
  value: LoginAccountType;
  onChange: (role: LoginAccountType) => void;
}) {
  return (
    <SegmentToggle
      options={['CANDIDATE', 'EMPLOYER']}
      value={value}
      onChange={onChange}
      labels={{ CANDIDATE: 'Candidate', EMPLOYER: 'Employer' }}
    />
  );
}

export function parseAccountKind(value: string | null | undefined): AccountKind {
  return value?.toUpperCase() === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
}

export function parseLoginAccountType(value: string | null | undefined): LoginAccountType {
  return value?.toUpperCase() === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
}
