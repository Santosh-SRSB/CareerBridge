const { PrismaClient } = require('../generated/prisma');
const p = new PrismaClient();
(async () => {
  const subs = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'employer_subscriptions' ORDER BY ordinal_position`,
  );
  const pays = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'employer_payments' AND (column_name LIKE '%plan%' OR column_name LIKE '%razor%') ORDER BY 1`,
  );
  console.log('subscriptions', subs);
  console.log('payments extra', pays);
  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
