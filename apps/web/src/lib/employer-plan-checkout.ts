import type { EmployerSubscriptionPlan } from '@careerbridge/shared';
import {
  createEmployerPlanOrder,
  createEnterpriseOfferOrder,
  getEmployerMe,
  syncEmployerPlanPayment,
  verifyEmployerPlanPayment,
} from '@/lib/api';
import { markEmployerPlanForJobPost } from '@/lib/employer-plan-gate';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';

async function loadCheckoutPrefill() {
  try {
    const me = await getEmployerMe();
    return {
      prefillName: me.contactName || me.companyName || '',
      prefillEmail: me.workEmail || '',
    };
  } catch {
    return {};
  }
}

async function finishRazorpayOrder(order: {
  paymentId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
  keyId: string;
  mode: string;
  plan: { id: string; name: string; priceLabel: string };
}) {
  if (order.mode === 'mock') {
    await verifyEmployerPlanPayment({
      paymentId: order.paymentId,
      razorpayOrderId: order.orderId,
      razorpayPaymentId: `pay_mock_${Date.now().toString(36)}`,
      razorpaySignature: 'mock_signature',
    });
    markEmployerPlanForJobPost(order.plan.id);
    return { mode: 'mock' as const, planId: order.plan.id };
  }

  const pollPaid = async () => {
    const status = await syncEmployerPlanPayment(order.paymentId);
    return Boolean(status.active && !status.pending);
  };

  const prefill = await loadCheckoutPrefill();
  const paid = await openRazorpayCheckout({
    keyId: order.keyId,
    orderId: order.orderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    name: 'SRSB CareerBridge',
    description: `${order.plan.name} plan ${order.plan.priceLabel}`,
    ...prefill,
    pollPaid,
  });

  if ('synced' in paid && paid.synced) {
    markEmployerPlanForJobPost(order.plan.id);
    return { mode: order.mode as 'live' | 'test', planId: order.plan.id };
  }

  const checkout = paid as {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  };
  await verifyEmployerPlanPayment({
    paymentId: order.paymentId,
    razorpayOrderId: checkout.razorpay_order_id,
    razorpayPaymentId: checkout.razorpay_payment_id,
    razorpaySignature: checkout.razorpay_signature,
  });
  markEmployerPlanForJobPost(order.plan.id);
  return { mode: order.mode as 'live' | 'test', planId: order.plan.id };
}

/** Secure checkout: server creates order → Razorpay (or mock) → server verifies → unlock plan. */
export async function checkoutEmployerPlan(plan: EmployerSubscriptionPlan) {
  if (plan.contactSales || plan.amountPaise == null) {
    throw new Error('This plan cannot be purchased online.');
  }
  const order = await createEmployerPlanOrder(plan.id);
  return finishRazorpayOrder(order);
}

/** Guide §12 — pay an admin-approved Enterprise offer (server-controlled amount). */
export async function checkoutEnterpriseOffer(offerId: string) {
  const order = await createEnterpriseOfferOrder(offerId);
  return finishRazorpayOrder(order);
}
