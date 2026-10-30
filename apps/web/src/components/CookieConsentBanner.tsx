'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getCookieConsent,
  isPublicConsentPath,
  openCookieSettings,
  setCookieConsent,
  subscribeCookieConsent,
  subscribeCookieSettingsOpen,
  type CookieConsentValue,
} from '@/lib/cookie-consent';

/**
 * Non-blocking marketing-cookie banner for public pages only.
 * Does not disable forms, navigation, or authentication.
 */
export function CookieConsentBanner() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<CookieConsentValue | null>(null);
  const [ready, setReady] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    setConsent(getCookieConsent());
    setReady(true);
    return subscribeCookieConsent((value) => {
      setConsent(value);
      if (value) setForceOpen(false);
    });
  }, []);

  useEffect(() => subscribeCookieSettingsOpen(() => setForceOpen(true)), []);

  const onPublicPage = isPublicConsentPath(pathname);
  // First-visit banner: public pages only. Cookie settings may reopen the choice anywhere.
  const show = ready && (forceOpen || (onPublicPage && consent === null));

  if (!show) return null;

  function choose(value: CookieConsentValue) {
    setCookieConsent(value);
    setConsent(value);
    setForceOpen(false);
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3 sm:p-4"
      role="region"
      aria-label="Cookie consent"
    >
      <div className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-[#d8d9e8] bg-white p-4 shadow-[0_12px_40px_rgba(16,19,124,0.14)] sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className="min-w-0 flex-1 text-sm leading-relaxed text-[#3a3d5c]">
          <p className="font-semibold text-[#10137c]">Cookies for advertising measurement</p>
          <p className="mt-1">
            If you accept, we use Meta Pixel on selected public pages to measure ads, registrations, and demo
            requests. Essential site features work either way.{' '}
            <Link href="/privacy" className="font-semibold text-[#1a1fc4] underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            {' · '}
            <button
              type="button"
              className="font-semibold text-[#1a1fc4] underline-offset-2 hover:underline"
              onClick={() => openCookieSettings()}
            >
              Cookie settings
            </button>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#10137c] px-5 text-sm font-bold text-white transition hover:bg-[#1a1fc4]"
            onClick={() => choose('accepted')}
          >
            Accept
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#c5c7db] bg-white px-5 text-sm font-bold text-[#10137c] transition hover:bg-[#f5f6fb]"
            onClick={() => choose('rejected')}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer / policy control that reopens the Accept / Reject choice. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => openCookieSettings()}>
      Cookie settings
    </button>
  );
}
