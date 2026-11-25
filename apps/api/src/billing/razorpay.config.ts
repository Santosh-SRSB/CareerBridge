export type RazorpayMode = 'mock' | 'live' | 'test';

export function razorpayKeyId() {
  return (process.env.RAZORPAY_KEY_ID || '').trim();
}

export function razorpayKeySecret() {
  return (process.env.RAZORPAY_KEY_SECRET || '').trim();
}

export function razorpayWebhookSecret() {
  return (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
}

/**
 * Effective mode. If live/test is selected but keys are missing, fall back to mock
 * so DEV (.co.in) checkout is not dead while Secret Manager is still being wired.
 */
export function razorpayMode(): RazorpayMode {
  const raw = (process.env.RAZORPAY_MODE || 'mock').trim().toLowerCase();
  if (raw === 'live' || raw === 'test') {
    if (razorpayKeyId() && razorpayKeySecret()) return raw;
    return 'mock';
  }
  return 'mock';
}

export function razorpayConfigured() {
  return razorpayMode() === 'mock' || Boolean(razorpayKeyId() && razorpayKeySecret());
}

/** Safe for clients — never includes secrets. */
export function razorpayPublicStatus() {
  const configuredEnv = Boolean(razorpayKeyId() && razorpayKeySecret());
  const requested = (process.env.RAZORPAY_MODE || 'mock').trim().toLowerCase();
  return {
    mode: razorpayMode(),
    requestedMode: requested === 'live' || requested === 'test' || requested === 'mock' ? requested : 'mock',
    keysPresent: configuredEnv,
    webhookSecretPresent: Boolean(razorpayWebhookSecret()),
    checkoutReady: razorpayConfigured(),
    /** When set, paid catalogue plans charge this paise amount (e.g. 100 = ₹1 test). */
    testAmountPaise: subscriptionTestAmountPaise(),
  };
}

/**
 * Temporary checkout override for smoke tests. Set EMPLOYER_SUBSCRIPTION_TEST_AMOUNT_PAISE=100
 * for ₹1 on Starter/Growth/Business; leave unset for real catalogue prices. Min 100 paise.
 */
export function subscriptionTestAmountPaise(): number | null {
  const raw = (process.env.EMPLOYER_SUBSCRIPTION_TEST_AMOUNT_PAISE || '').trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 100) return null;
  return Math.round(n);
}
