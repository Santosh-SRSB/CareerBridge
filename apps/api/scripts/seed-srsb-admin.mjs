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

const email = (process.env.SRSB_ADMIN_EMAIL || 'sureshababu5555@gmail.com').trim().toLowerCase();
const password = process.env.SRSB_ADMIN_PASSWORD || '-Suresh@babu@tiya123$#';
const phone = process.env.SRSB_ADMIN_PHONE || '+919999999025';
const legacyEmails = ['srsbhr25@gmail.com'];

const prisma = new PrismaClient();
const passwordHash = await hashPlatformPassword(password);

let user = await prisma.user.findFirst({
  where: { email, userType: { in: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] } },
});

if (!user) {
  const legacy = await prisma.user.findFirst({
    where: {
      email: { in: legacyEmails },
      userType: { in: ['SUPER_ADMIN', 'PLATFORM_ADMIN'] },
    },
  });
  if (legacy) {
    user = await prisma.user.update({
      where: { id: legacy.id },
      data: {
        email,
        phone,
        passwordHash,
        externalAuthId: `admin_portal_${email}`,
        userType: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
    const legacyAdmin = await prisma.admin.findFirst({
      where: { email: { in: legacyEmails } },
    });
    if (legacyAdmin) {
      await prisma.admin.update({
        where: { id: legacyAdmin.id },
        data: {
          email,
          passwordHash,
          loginPassword: password,
          fullName: 'SRSB Super Admin',
          status: 'ACTIVE',
          userId: user.id,
        },
      });
    }
    console.log('migrated user', user.id);
  }
}

if (!user) {
  user = await prisma.user.create({
    data: {
      email,
      phone,
      passwordHash,
      externalAuthId: `admin_portal_${email}`,
      userType: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('created user', user.id);
} else {
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      phone,
      passwordHash,
      userType: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('updated user', user.id);
}

const admin = await prisma.admin.upsert({
  where: { email },
  update: {
    passwordHash,
    loginPassword: password,
    fullName: 'SRSB Super Admin',
    status: 'ACTIVE',
    userId: user.id,
  },
  create: {
    email,
    passwordHash,
    loginPassword: password,
    fullName: 'SRSB Super Admin',
    status: 'ACTIVE',
    userId: user.id,
  },
});

const otherSuperAdmins = await prisma.user.findMany({
  where: { userType: 'SUPER_ADMIN', NOT: { id: user.id } },
  select: { id: true, email: true },
});
for (const other of otherSuperAdmins) {
  await prisma.user.update({
    where: { id: other.id },
    data: { status: 'INACTIVE' },
  });
  if (other.email) {
    await prisma.admin.updateMany({
      where: { email: other.email },
      data: { status: 'INACTIVE' },
    });
  }
}

console.log('admin ready', admin.id, admin.email);
await prisma.$disconnect();
