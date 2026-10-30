'use client';

import { CookieSettingsLink } from '@/components/CookieConsentBanner';

/** Client island on the Privacy Policy page for changing advertising cookie choice. */
export function PrivacyCookieSettingsNote() {
  return (
    <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
      To Accept or Reject advertising measurement cookies (including Meta Pixel), open{' '}
      <CookieSettingsLink className="font-semibold text-[#1a1fc4] underline-offset-2 hover:underline" />.
    </p>
  );
}
