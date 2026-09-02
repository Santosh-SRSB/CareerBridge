export const billingConfig = () => ({
  paymentProvider: process.env.PAYMENT_PROVIDER || 'razorpay',
  webhookSecret: process.env.BILLING_WEBHOOK_SECRET || '',
});
