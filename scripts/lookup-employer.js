const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('../apps/api/generated/prisma');

function loadEnv() {
  const text = fs.readFileSync(path.join(__dirname, '../apps/api/.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    process.env[line.slice(0, idx)] = line.slice(idx + 1);
  }
}

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  try {
    const email = 'priyanayak.dev@gmail.com';
    const user = await prisma.user.findFirst({
      where: { email },
      include: { employer: true, candidate: true },
    });
    if (!user) {
      console.log('user_missing');
      return;
    }
    console.log(
      JSON.stringify({
        found: true,
        userType: user.userType,
        status: user.status,
        hasPassword: Boolean(user.passwordHash),
        hasEmployer: Boolean(user.employer),
        verification: user.employer?.verificationStatus || null,
      }),
    );
  } catch (error) {
    console.error('lookup_fail', String(error.message || error).split('\n')[0]);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
