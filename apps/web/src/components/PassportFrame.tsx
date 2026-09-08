'use client';

import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { PassportSectionKey } from '@careerbridge/shared';
import { CandidateAppShell } from '@/components/CandidateAppShell';

export function PassportFrame({
  title,
  subtitle,
  step: _step,
  children,
}: {
  title: string;
  subtitle?: string;
  step?: PassportSectionKey;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <CandidateAppShell
      activeTab="profile"
      showBack
      title={title}
      headerVariant="simple"
      maxWidth="max-w-lg"
      onBack={() => router.push('/profile')}
    >
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="text-sm leading-relaxed text-slate-500">{subtitle}</p> : null}
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">{children}</div>
      </div>
    </CandidateAppShell>
  );
}

export const passportPrimaryButtonClass =
  'w-full sm:w-auto px-8 py-3 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white rounded-xl shadow-sm';

export const passportSecondaryButtonClass =
  'w-full sm:w-auto px-6 py-3 text-sm font-bold rounded-xl border-slate-200 text-slate-800';

export function PassportLoading() {
  return (
    <CandidateAppShell activeTab="profile" showBack title="My profile" headerVariant="simple">
      <div className="p-8 text-center text-sm text-slate-500">Loading profile...</div>
    </CandidateAppShell>
  );
}

export function PassportRecord({
  title,
  subtitle,
  detail,
  onRemove,
}: {
  title: string;
  subtitle?: string;
  detail?: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{title}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
      </div>
      <button type="button" className="shrink-0 text-xs font-semibold text-error" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

export function WizardActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5 mt-5">
      {children}
    </div>
  );
}

export function Chip({
  selected,
  onClick,
  className = '',
  children,
}: {
  selected: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
        selected
          ? 'border-[#3b6cf4] bg-[#3b6cf4] text-white shadow-xs'
          : 'border-slate-200 bg-white text-slate-700 hover:border-[#3b6cf4]/30 hover:bg-slate-50'
      } ${className}`.trim()}
    >
      {children}
    </button>
  );
}
