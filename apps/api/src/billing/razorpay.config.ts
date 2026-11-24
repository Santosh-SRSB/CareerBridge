export type RazorpayMode = 'mock' | 'live' | 'test';

export function razorpayMode(): RazorpayMode {
  const raw = (process.env.RAZORPAY_MODE || 'mock').trim().toLowerCase();
  if (raw === 'live' || raw === 'test') return raw;
  return 'mock';
}

export function razorpayKeyId() {
  return (process.env.RAZORPAY_KEY_ID || '').trim();
}

export function razorpayKeySecret() {
  return (process.env.RAZORPAY_KEY_SECRET || '').trim();
}

export function razorpayWebhookSecret() {
  return (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
}

export function razorpayConfigured() {
  if (razorpayMode() === 'mock') return true;
  return Boolean(razorpayKeyId() && razorpayKeySecret());
}
