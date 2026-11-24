import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import {
  razorpayKeyId,
  razorpayKeySecret,
  razorpayMode,
  razorpayWebhookSecret,
} from './razorpay.config';

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

function basicAuthHeader() {
  const token = Buffer.from(`${razorpayKeyId()}:${razorpayKeySecret()}`).toString('base64');
  return `Basic ${token}`;
}

export async function createRazorpayOrder(input: {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  if (razorpayMode() === 'mock') {
    return {
      id: `order_mock_${randomBytes(8).toString('hex')}`,
      amount: input.amountPaise,
      currency: input.currency || 'INR',
      receipt: input.receipt,
      status: 'created',
    };
  }

  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: input.currency || 'INR',
      receipt: input.receipt.slice(0, 40),
      notes: input.notes || {},
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Razorpay order failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as RazorpayOrder;
  return data;
}

export function verifyPaymentSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  if (razorpayMode() === 'mock') {
    return (
      input.orderId.startsWith('order_mock_') &&
      (input.signature === 'mock_signature' || input.paymentId.startsWith('pay_mock_'))
    );
  }

  const secret = razorpayKeySecret();
  if (!secret || !input.signature) return false;
  const expected = createHmac('sha256', secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(input.signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type RazorpayPaymentEntity = {
  id: string;
  status: string;
  amount: number;
  order_id?: string;
  currency?: string;
  error_description?: string | null;
  error_reason?: string | null;
};

/** Server-side: list payments for an order (used when Checkout handler does not fire after UPI QR). */
export async function fetchRazorpayOrderPayments(orderId: string): Promise<RazorpayPaymentEntity[]> {
  if (razorpayMode() === 'mock') return [];
  const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
    method: 'GET',
    headers: { Authorization: basicAuthHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Razorpay order payments failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { items?: RazorpayPaymentEntity[] };
  return Array.isArray(data.items) ? data.items : [];
}

export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  const secret = razorpayWebhookSecret();
  if (!secret || !signature) return false;
  const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
