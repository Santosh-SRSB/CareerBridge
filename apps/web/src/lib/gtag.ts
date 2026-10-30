declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

type AdsConversionKey = "SIGNUP" | "LEAD" | "APPLY" | "EMPLOYER_SIGNUP";

function adsLabel(key: AdsConversionKey): string | undefined {
  const labels: Record<AdsConversionKey, string | undefined> = {
    SIGNUP: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_SIGNUP,
    LEAD: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_LEAD,
    APPLY: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_APPLY,
    EMPLOYER_SIGNUP: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_EMPLOYER_SIGNUP,
  };
  return labels[key]?.trim() || undefined;
}

/** Fire a Google Ads conversion when AW- id + label env vars are set. No-ops otherwise. */
export function trackGoogleAdsConversion(key: AdsConversionKey) {
  const id = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim();
  const label = adsLabel(key);
  if (!id || !label || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }
  window.gtag("event", "conversion", { send_to: `${id}/${label}` });
}

/** GA4 recommended / custom event (works with existing G- tag). */
export function trackGa4Event(
  name: string,
  params?: Record<string, string | number | boolean>,
) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}
