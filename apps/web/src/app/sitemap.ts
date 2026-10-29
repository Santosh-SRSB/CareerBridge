import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.srsbcareerbridge.com').replace(
  /\/$/,
  '',
);

const STATIC: MetadataRoute.Sitemap = [
  { url: `${SITE}/`, changeFrequency: 'daily', priority: 1 },
  { url: `${SITE}/welcome`, changeFrequency: 'weekly', priority: 0.9 },
  { url: `${SITE}/jobs`, changeFrequency: 'hourly', priority: 0.9 },
  { url: `${SITE}/employer/welcome`, changeFrequency: 'weekly', priority: 0.9 },
  { url: `${SITE}/register`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE}/employer/register`, changeFrequency: 'monthly', priority: 0.8 },
  { url: `${SITE}/login`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE}/testimonials`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${SITE}/courses`, changeFrequency: 'weekly', priority: 0.7 },
  { url: `${SITE}/support`, changeFrequency: 'monthly', priority: 0.6 },
  { url: `${SITE}/privacy`, changeFrequency: 'yearly', priority: 0.4 },
  { url: `${SITE}/terms`, changeFrequency: 'yearly', priority: 0.4 },
  { url: `${SITE}/employer/terms`, changeFrequency: 'yearly', priority: 0.4 },
];

type JobsListResponse = {
  items?: Array<{ id: string; updatedAt?: string; createdAt?: string }>;
};

async function publishedJobUrls(): Promise<MetadataRoute.Sitemap> {
  const api = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (!api) return [];

  const out: MetadataRoute.Sitemap = [];
  const pageSize = 100;
  let page = 1;
  let total = Infinity;

  try {
    while (out.length < total && page <= 20) {
      const res = await fetch(`${api}/jobs?page=${page}&pageSize=${pageSize}&sort=newest`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const data = (await res.json()) as JobsListResponse & { total?: number };
      const items = data.items ?? [];
      if (typeof data.total === 'number') total = data.total;
      for (const job of items) {
        if (!job?.id) continue;
        out.push({
          url: `${SITE}/jobs/${job.id}`,
          lastModified: job.updatedAt || job.createdAt || new Date(),
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
      if (items.length < pageSize) break;
      page += 1;
    }
  } catch {
    return out;
  }

  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const jobs = await publishedJobUrls();
  return [...STATIC, ...jobs];
}
