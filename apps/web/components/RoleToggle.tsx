'use client';

import type { AccountKind } from '@careerbridge/shared';

export function RoleToggle({
  value,
  onChange,
}: {
  value: AccountKind;
  onChange: (role: AccountKind) => void;
}) {
  return (
    <div className="relative grid grid-cols-2 rounded-md bg-primary/5 p-0.5 ring-1 ring-primary/10">
      <span
        className={`absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-sm bg-primary shadow-sm transition-transform duration-300 ease-out ${
          value === 'EMPLOYER' ? 'translate-x-full' : 'translate-x-0'
        }`}
      />
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => onChange('CANDIDATE')}
        className={`relative z-10 rounded-sm px-2 py-2 text-xs font-bold transition-colors duration-300 ${
          value === 'CANDIDATE' ? 'text-white' : 'text-primary/60 hover:text-primary'
        }`}
      >
        Candidate
      </button>
      <button
        type="button"
        suppressHydrationWarning
        onClick={() => onChange('EMPLOYER')}
        className={`relative z-10 rounded-sm px-2 py-2 text-xs font-bold transition-colors duration-300 ${
          value === 'EMPLOYER' ? 'text-white' : 'text-primary/60 hover:text-primary'
        }`}
      >
        Employer
      </button>
    </div>
  );
}

export function parseAccountKind(value: string | null | undefined): AccountKind {
  return value?.toUpperCase() === 'EMPLOYER' ? 'EMPLOYER' : 'CANDIDATE';
}
