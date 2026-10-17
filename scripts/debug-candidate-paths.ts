/**
 * Live diagnostic Steps 1–2: DB rows + GCS key collision check for Nagendra/Keerthi.
 * Usage (from apps/api):
 *   npx ts-node -r ts-node/register/transpile-only -r dotenv/config ../../scripts/debug-candidate-paths.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '../apps/api/src/prisma/client';

config({ path: resolve(__dirname, '../apps/api/.env') });
config({ path: resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

function safeJson(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { _parseError: true, preview: raw.slice(0, 200) };
  }
}

function fullNameFrom(content: Record<string, unknown> | null, first?: string | null, last?: string | null) {
  if (content && typeof content.fullName === 'string' && content.fullName.trim()) return content.fullName.trim();
  return [first, last].filter(Boolean).join(' ') || null;
}

function baseAndHash(path: string | null | undefined) {
  if (!path) return { base: null, hashSuffix: null, pattern: null as string | null };
  const name = path.split('/').pop() || path;
  const m = name.match(/^(.*)-([0-9a-fA-F]{8,})(\.[^.]+)?$/);
  if (!m) return { base: name.replace(/\.[^.]+$/, ''), hashSuffix: null, pattern: name };
  return { base: m[1], hashSuffix: m[2], pattern: `${m[1]}-{hex}${m[3] || ''}` };
}

async function main() {
  const url = process.env.DATABASE_URL || '';
  console.log('=== STEP 1: DB connection ===');
  console.log(url.replace(/:([^:@/]+)@/, ':****@') || '(DATABASE_URL missing)');

  const candidates = await prisma.candidate.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Nagendra', mode: 'insensitive' } },
        { lastName: { contains: 'Nagendra', mode: 'insensitive' } },
        { firstName: { contains: 'Keerthi', mode: 'insensitive' } },
        { lastName: { contains: 'Keerthi', mode: 'insensitive' } },
        { firstName: { contains: 'Mahto', mode: 'insensitive' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      resumes: {
        where: { archivedAt: null },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });

  console.log('\n=== STEP 1 RAW: candidates matching Nagendra|Keerthi (case-insensitive) ===');
  console.log(`count=${candidates.length}`);

  const step1Rows: Array<{
    id: string;
    fullName: string | null;
    sourceStoragePath: string | null;
    extractionMeta: unknown;
    updatedAt: Date;
    createdAt: Date;
    resumeId?: string;
    sourceFileName?: string | null;
    rawTextHasKeerthi?: boolean;
    rawTextHasNagendra?: boolean;
    contentHasKeerthi?: boolean;
    contentHasNagendra?: boolean;
  }> = [];

  for (const c of candidates) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
    if (!c.resumes.length) {
      const row = {
        id: c.id,
        fullName: name || null,
        sourceStoragePath: null,
        extractionMeta: null,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
      };
      step1Rows.push(row);
      console.log('--- candidate (no resumes) ---');
      console.log(JSON.stringify(row, null, 2));
      continue;
    }
    for (const r of c.resumes) {
      const content = safeJson(r.contentJson) as Record<string, unknown> | null;
      const meta = safeJson(r.extractionMetaJson);
      const row = {
        id: c.id,
        resumeId: r.id,
        fullName: fullNameFrom(content, c.firstName, c.lastName),
        sourceStoragePath: r.sourceStoragePath,
        sourceFileName: r.sourceFileName,
        extractionMeta: meta,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        rawTextHasKeerthi: /keerthi/i.test(r.rawText || ''),
        rawTextHasNagendra: /nagendra/i.test(r.rawText || ''),
        contentHasKeerthi: /keerthi/i.test(r.contentJson || ''),
        contentHasNagendra: /nagendra/i.test(r.contentJson || ''),
        rawTextPreview: (r.rawText || '').slice(0, 240),
      };
      step1Rows.push(row);
      console.log('--- match ---');
      console.log(JSON.stringify(row, null, 2));
    }
  }

  // Also catch content contamination where candidate name is not Nagendra/Keerthi
  const contaminated = await prisma.resume.findMany({
    where: {
      OR: [
        { contentJson: { contains: 'Keerthi', mode: 'insensitive' } },
        { contentJson: { contains: 'Nagendra', mode: 'insensitive' } },
        { rawText: { contains: 'Keerthi', mode: 'insensitive' } },
        { rawText: { contains: 'Nagendra', mode: 'insensitive' } },
        { sourceFileName: { contains: 'Nagendra', mode: 'insensitive' } },
        { sourceFileName: { contains: 'Keerthi', mode: 'insensitive' } },
        { sourceFileName: { contains: 'Mahto', mode: 'insensitive' } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    include: { candidate: true },
  });

  console.log('\n=== STEP 1 EXTRA: resumes with Nagendra/Keerthi in content/raw/filename ===');
  console.log(`count=${contaminated.length}`);
  for (const r of contaminated) {
    const content = safeJson(r.contentJson) as Record<string, unknown> | null;
    const meta = safeJson(r.extractionMetaJson);
    console.log('--- resume ---');
    console.log(
      JSON.stringify(
        {
          id: r.id,
          candidateId: r.candidateId,
          fullName: fullNameFrom(content, r.candidate.firstName, r.candidate.lastName),
          sourceStoragePath: r.sourceStoragePath,
          sourceStorageUri: r.sourceStorageUri,
          sourceFileName: r.sourceFileName,
          processingStatus: r.processingStatus,
          extractionMeta: meta,
          updatedAt: r.updatedAt,
          createdAt: r.createdAt,
          rawTextHasKeerthi: /keerthi/i.test(r.rawText || ''),
          rawTextHasNagendra: /nagendra/i.test(r.rawText || ''),
          contentHasKeerthi: /keerthi/i.test(r.contentJson || ''),
          contentHasNagendra: /nagendra/i.test(r.contentJson || ''),
          rawTextPreview: (r.rawText || '').slice(0, 240),
          contentPreview: content
            ? {
                fullName: content.fullName,
                skills: Array.isArray(content.skills) ? content.skills.slice(0, 15) : content.skills,
                education: Array.isArray(content.education) ? content.education.slice(0, 6) : content.education,
              }
            : null,
        },
        null,
        2,
      ),
    );
  }

  console.log('\n=== STEP 2: storage key collision analysis (from DB paths) ===');
  const paths = contaminated
    .map((r) => ({
      id: r.id,
      fullName: fullNameFrom(safeJson(r.contentJson) as Record<string, unknown> | null, r.candidate.firstName, r.candidate.lastName),
      sourceFileName: r.sourceFileName,
      sourceStoragePath: r.sourceStoragePath,
      ...baseAndHash(r.sourceStoragePath),
    }))
    .filter((p) => p.sourceStoragePath || p.sourceFileName);
  console.log(JSON.stringify(paths, null, 2));

  const nonNullPaths = paths.map((p) => p.sourceStoragePath).filter(Boolean) as string[];
  const uniquePaths = new Set(nonNullPaths);
  console.log(`nonNull sourceStoragePath count=${nonNullPaths.length}`);
  console.log(`unique sourceStoragePath count=${uniquePaths.size}`);
  console.log(`same key among DB rows? ${nonNullPaths.length > 1 && uniquePaths.size < nonNullPaths.length ? 'YES' : 'NO (or paths null)'}`);

  // Historical truncated keys from API logs (8-hex uniquePart)
  const historicalKeys = [
    'resumes/NagendraMahto_resume_04_2026-b8f39037.pdf',
    'resumes/NagendraMahto_resume_04_2026-fa7d8eee.pdf',
    'resumes/NagendraMahto_resume_04_2026-e6345f76.pdf',
    'resumes/Keerthi_CV-43913406.pdf',
    'resumes/CURRICULUM_VITAE-43913406.pdf',
  ];
  console.log('\nHistorical truncated keys from API logs (billing-disabled era):');
  console.log(JSON.stringify(historicalKeys, null, 2));
  console.log(
    'Note: Keerthi_CV and CURRICULUM_VITAE both used uniquePart=43913406 (first 8 of same resumeId) — different bases, so not same object key.',
  );

  console.log('\n=== STEP 2: GCS bucket listing attempt ===');
  const bucketName = process.env.GCS_BUCKET || 'srsbbucket';
  const projectId = process.env.GCP_PROJECT_ID || undefined;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined;
  console.log(
    JSON.stringify(
      {
        bucketName,
        projectId: projectId || null,
        keyFile: keyFile || '(ADC / default)',
      },
      null,
      2,
    ),
  );

  try {
    const { Storage } = await import('@google-cloud/storage');
    const storage = new Storage({ projectId, keyFilename: keyFile });
    const bucket = storage.bucket(bucketName);

    const prefixes = ['resumes/Nagendra', 'resumes/Keerthi', 'resumes/CURRICULUM', 'resumes/IT-Resume', 'resumes/portal', 'resumes/original'];
    for (const prefix of prefixes) {
      console.log(`\n--- GCS list prefix=${prefix} ---`);
      try {
        const [files] = await bucket.getFiles({ prefix, maxResults: 50 });
        if (!files.length) {
          console.log('(no objects)');
          continue;
        }
        for (const f of files) {
          const [meta] = await f.getMetadata();
          console.log(
            JSON.stringify({
              name: f.name,
              size: meta.size,
              updated: meta.updated,
              md5Hash: meta.md5Hash,
              generation: meta.generation,
            }),
          );
        }
      } catch (err) {
        console.log(`LIST_ERROR for ${prefix}: ${(err as Error).message}`);
      }
    }

    console.log('\n--- GCS exists() for DB sourceStoragePath values ---');
    for (const p of uniquePaths) {
      try {
        const [exists] = await bucket.file(p).exists();
        console.log(JSON.stringify({ path: p, exists }));
      } catch (err) {
        console.log(JSON.stringify({ path: p, error: (err as Error).message }));
      }
    }
    if (!uniquePaths.size) {
      console.log('(all DB sourceStoragePath values are null — nothing to exists()-check)');
    }

    console.log('\n--- GCS exists() for historical truncated keys ---');
    for (const p of historicalKeys) {
      try {
        const [exists] = await bucket.file(p).exists();
        console.log(JSON.stringify({ path: p, exists }));
      } catch (err) {
        console.log(JSON.stringify({ path: p, error: (err as Error).message }));
      }
    }
  } catch (err) {
    console.log(`GCS_CLIENT_ERROR: ${(err as Error).message}`);
  }
}

main()
  .catch((err) => {
    console.error('SCRIPT_ERROR', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
