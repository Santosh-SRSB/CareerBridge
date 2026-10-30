'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { getCookieConsent, hasMarketingConsent, subscribeCookieConsent } from '@/lib/cookie-consent';
import {
  ensureMetaPixelLoaded,
  isMetaPixelAllowlisted,
  revokeMetaPixelConsent,
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
      if (!hasMarketingConsent()) {
        revokeMetaPixelConsent();
        return;
      }
      if (!isMetaPixelAllowlisted(pathname)) {
        return;
      }
      if (!ensureMetaPixelLoaded()) return;
      trackMetaPageView(pathname);
    }

    sync();
    return subscribeCookieConsent(() => {
      if (getCookieConsent() !== 'accepted') {
        // Reject or cleared choice: block PageView/conversions and Meta init until Accept again.
        revokeMetaPixelConsent();
        return;
      }
      sync();
    });
  }, [pathname]);

  return null;
}
