'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getCookieConsent, hasMarketingConsent, subscribeCookieConsent } from '@/lib/cookie-consent';
import {
  ensureMetaPixelLoaded,
  isMetaPixelAllowlisted,
  resetMetaPageViewDedupe,
  trackMetaPageView,
} from '@/lib/meta-pixel';

/**
 * Loads Meta Pixel only when marketing consent is accepted and the route is allowlisted.
 * Google Analytics / Google Ads tags are independent and untouched.
 */
export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    function sync() {
      if (!hasMarketingConsent() || !isMetaPixelAllowlisted(pathname)) {
        resetMetaPageViewDedupe();
        return;
      }
      if (!ensureMetaPixelLoaded()) return;
      trackMetaPageView(pathname);
    }

    sync();
    return subscribeCookieConsent(() => {
      if (getCookieConsent() === 'rejected') {
        resetMetaPageViewDedupe();
        return;
      }
      sync();
    });
  }, [pathname]);

  return null;
}
