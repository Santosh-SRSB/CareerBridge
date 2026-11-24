export type RazorpayCheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Razorpay script failed')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpay = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay script failed to load'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(input: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefillEmail?: string;
  prefillName?: string;
  /** Called while Checkout is open (e.g. poll server for UPI QR capture). Return true to finish. */
  pollPaid?: () => Promise<boolean>;
}): Promise<RazorpayCheckoutSuccess | { synced: true }> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay is unavailable');

  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const finish = (value: RazorpayCheckoutSuccess | { synced: true }) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      resolve(value);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      reject(err);
    };

    const rzp = new window.Razorpay!({
      key: input.keyId,
      amount: input.amountPaise,
      currency: input.currency,
      name: input.name,
      description: input.description,
      order_id: input.orderId,
      theme: { color: '#FBBF24' },
      prefill: {
        email: input.prefillEmail || '',
        name: input.prefillName || '',
      },
      handler: (response: RazorpayCheckoutSuccess) => finish(response),
      modal: {
        ondismiss: async () => {
          if (settled) return;
          // Last chance: UPI may have paid while QR stayed open / user closed modal.
          if (input.pollPaid) {
            try {
              if (await input.pollPaid()) {
                finish({ synced: true });
                return;
              }
            } catch {
              /* fall through */
            }
          }
          fail(new Error('Payment cancelled'));
        },
      },
    });
    rzp.on('payment.failed', () => fail(new Error('Payment failed')));
    rzp.open();

    if (input.pollPaid) {
      pollTimer = setInterval(() => {
        void input.pollPaid!()
          .then((ok) => {
            if (ok) finish({ synced: true });
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err || '');
            // Definitive Razorpay failures (website mismatch, risk block, etc.) — stop waiting.
            if (/blocked|does not match|payment failed|risk_check|BAD_REQUEST/i.test(msg)) {
              fail(err instanceof Error ? err : new Error(msg));
            }
          });
      }, 3000);
    }
  });
}
