import type { EmployerSubscriptionPlan } from '@careerbridge/shared';
import {
  createEmployerPlanOrder,
  syncEmployerPlanPayment,
  verifyEmployerPlanPayment,
} from '@/lib/api';
import { markEmployerPlanForJobPost } from '@/lib/employer-plan-gate';
import { openRazorpayCheckout } from '@/lib/razorpay-checkout';

/** Secure checkout: server creates order → Razorpay (or mock) → server verifies → unlock plan. */
export async function checkoutEmployerPlan(plan: EmployerSubscriptionPlan) {
  if (plan.contactSales || plan.amountPaise == null) {
    throw new Error('This plan cannot be purchased online.');
  }

  const order = await createEmployerPlanOrder(plan.id);

  if (order.mode === 'mock') {
    await verifyEmployerPlanPayment({
      paymentId: order.paymentId,
      razorpayOrderId: order.orderId,
      razorpayPaymentId: `pay_mock_${Date.now().toString(36)}`,
      razorpaySignature: 'mock_signature',
    });
    markEmployerPlanForJobPost(plan.id);
    return { mode: 'mock' as const, planId: plan.id };
  }

  const pollPaid = async () => {
    const status = await syncEmployerPlanPayment(order.paymentId);
    return Boolean(status.active && !status.pending);
  };

  const paid = await openRazorpayCheckout({
    keyId: order.keyId,
    orderId: order.orderId,
    amountPaise: order.amountPaise,
    currency: order.currency,
    name: 'SRSB CareerBridge',
    description: `${order.plan.name} plan ${order.plan.priceLabel}`,
    pollPaid,
  });

  if ('synced' in paid && paid.synced) {
    markEmployerPlanForJobPost(plan.id);
    return { mode: order.mode as 'live' | 'test', planId: plan.id };
  }

  await verifyEmployerPlanPayment({
    paymentId: order.paymentId,
    razorpayOrderId: paid.razorpay_order_id,
    razorpayPaymentId: paid.razorpay_payment_id,
    razorpaySignature: paid.razorpay_signature,
  });
  markEmployerPlanForJobPost(plan.id);
  return { mode: order.mode as 'live' | 'test', planId: plan.id };
}
