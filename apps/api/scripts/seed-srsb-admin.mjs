import { PrismaClient } from '../generated/prisma/index.js';
import { randomBytes, scrypt as scryptCb } from 'crypto';

function scryptPlatform(password, salt) {
  return new Promise((resolve, reject) => {
    scryptCb(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

async function hashPlatformPassword(password) {
  const salt = randomBytes(32).toString('hex');
  const derived = await scryptPlatform(password, salt);
  return `v2:${salt}:${derived.toString('hex')}`;
}

const email = (process.env.SRSB_ADMIN_EMAIL || 'srsbhr25@gmail.com').trim().toLowerCase();
const password = process.env.SRSB_ADMIN_PASSWORD || 'srsb@suresh25';
const phone = process.env.SRSB_ADMIN_PHONE || '+919999999025';

const prisma = new PrismaClient();
const passwordHash = await hashPlatformPassword(password);

let user = await prisma.user.findFirst({
  where: { email, userType: 'PLATFORM_ADMIN' },
});

if (!user) {
  user = await prisma.user.create({
    data: {
      email,
      phone,
      passwordHash,
      externalAuthId: `admin_portal_${email}`,
      userType: 'PLATFORM_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('created user', user.id);
} else {
  user = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, status: 'ACTIVE' },
  });
  console.log('updated user', user.id);
}

const admin = await prisma.admin.upsert({
  where: { email },
  update: {
    passwordHash,
    fullName: 'SRSB Admin',
    status: 'ACTIVE',
    userId: user.id,
  },
  create: {
    email,
    passwordHash,
    fullName: 'SRSB Admin',
    status: 'ACTIVE',
    userId: user.id,
  },
});

console.log('admin ready', admin.id, admin.email);
await prisma.$disconnect();
