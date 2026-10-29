import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.srsbcareerbridge.com').replace(
  /\/$/,
  '',
);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/passport',
          '/profile',
          '/onboarding',
          '/applications',
          '/notifications',
          '/resume',
          '/resumes',
          '/interviews',
          '/assessments',
          '/admin',
          '/adminsrsb',
          '/srsbaadmin',
          '/employer/jobs',
          '/employer/candidates',
          '/employer/applications',
          '/employer/billing',
          '/employer/payments',
          '/employer/interviews',
          '/employer/kyc',
          '/employer/profile',
          '/employer/reports',
          '/employer/history',
          '/employer/verify',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
