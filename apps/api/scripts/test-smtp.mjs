import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

const envPath = path.join(process.cwd(), '.env');
const env = Object.fromEntries(
  fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const user = env.SMTP_USER;
const pass = env.SMTP_PASS;
const port = Number(env.SMTP_PORT || 587);

if (!user || !pass) {
  console.error('SMTP_USER or SMTP_PASS missing in apps/api/.env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'smtp.gmail.com',
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
  tls: { minVersion: 'TLSv1.2' },
});

try {
  await transporter.verify();
  console.log(`SMTP OK for ${user}`);
} catch (error) {
  console.error('SMTP FAIL:', error instanceof Error ? error.message : error);
  process.exit(1);
}
