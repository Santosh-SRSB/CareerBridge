import Script from "next/script";

/** GA4 Google tag from Analytics (override via NEXT_PUBLIC_GOOGLE_TAG_ID if needed). */
const GOOGLE_TAG_ID =
  process.env.NEXT_PUBLIC_GOOGLE_TAG_ID?.trim() || "G-MYX8NYJWH9";

/** Optional Google Ads conversion ID (AW-…). Set after creating conversions in Ads. */
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim() || "";

/**
 * Google tag (gtag.js). Loads after the page is interactive so it never blocks render.
 * Inline loader avoids a Next/React 19 Script `src` typing mismatch.
 */
export function GoogleTag() {
  const adsConfig = GOOGLE_ADS_ID
    ? `gtag('config', '${GOOGLE_ADS_ID}');`
    : "";

  return (
    <Script id="google-tag" strategy="afterInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = gtag;
        gtag('js', new Date());
        gtag('config', '${GOOGLE_TAG_ID}');
        ${adsConfig}
        (function(){
          var s = document.createElement('script');
          s.async = true;
          s.src = 'https://www.googletagmanager.com/gtag/js?id=${GOOGLE_TAG_ID}';
          document.head.appendChild(s);
        })();
      `}
    </Script>
  );
}
