const { PrismaClient } = require('../generated/prisma');
const p = new PrismaClient();
(async () => {
  const rows = await p.employerPayment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
  });
  console.log(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      amountPaise: r.amountPaise,
      planId: r.planId,
      orderId: r.razorpayOrderId,
      payId: r.razorpayPaymentId,
      createdAt: r.createdAt,
    })),
  );
  const subs = await p.employerSubscription.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log('subs', subs);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
