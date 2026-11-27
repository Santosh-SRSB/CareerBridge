export type RazorpayCheckoutSuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

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
  /** Prefill mobile so Checkout does not ask for phone again. */
  prefillContact?: string;
  /** Called while Checkout is open (e.g. poll server for UPI QR capture). Return true to finish. */
  pollPaid?: () => Promise<boolean>;
}): Promise<RazorpayCheckoutSuccess | { synced: true }> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay is unavailable');

  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let rzp: RazorpayInstance;

    const clearPoll = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const closeModal = () => {
      try {
        rzp?.close();
      } catch {
        /* modal may already be gone */
      }
    };

    const finish = (value: RazorpayCheckoutSuccess | { synced: true }) => {
      if (settled) return;
      settled = true;
      clearPoll();
      // Mark settled before close so ondismiss does not treat this as cancel.
      closeModal();
      resolve(value);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearPoll();
      closeModal();
      reject(err);
    };

    const prefillEmail = (input.prefillEmail || '').trim();
    const prefillContact = (input.prefillContact || '').trim();
    const prefillName = (input.prefillName || '').trim();
    // When email + mobile are already known, lock them so Checkout skips "Contact details".
    const readonly =
      prefillEmail && prefillContact
        ? { email: true as const, contact: true as const }
        : prefillEmail
          ? { email: true as const }
          : undefined;

    rzp = new window.Razorpay!({
      key: input.keyId,
      amount: input.amountPaise,
      currency: input.currency,
      name: input.name,
      description: input.description,
      order_id: input.orderId,
      theme: { color: '#1A1FC4' },
      prefill: {
        email: prefillEmail,
        name: prefillName,
        contact: prefillContact,
      },
      ...(readonly ? { readonly } : {}),
      // Employer subscriptions: UPI / cards / netbanking / wallet only — no EMI.
      config: {
        display: {
          hide: [{ method: 'emi' }],
        },
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
    rzp.on('payment.failed', () => {
      // UPI QR can still succeed after a failed attempt — keep polling, do not close.
    });
    rzp.open();

    if (input.pollPaid) {
      const tick = () => {
        void input.pollPaid!()
          .then((ok) => {
            if (ok) finish({ synced: true });
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err || '');
            // Only stop for hard website/risk blocks — not transient UPI failures.
            if (/does not match registered website|risk_check|website.*not.*registered/i.test(msg)) {
              fail(err instanceof Error ? err : new Error(msg));
            }
          });
      };
      tick();
      pollTimer = setInterval(tick, 2000);
    }
  });
}
