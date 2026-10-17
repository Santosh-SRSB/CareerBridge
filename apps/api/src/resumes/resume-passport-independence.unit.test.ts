/**
 * CP-10: a resume is generated from Career Passport data as an independent, editable version.
 * The Career Passport remains the master source of truth and is not modified when a resume version is edited.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ResumesService } from './resumes.service';
import { IntelligenceService } from '../intelligence/intelligence.service';

type Row = Record<string, any>;

function harness() {
  const passport = {
    id: 'cand-a',
    userId: 'user-a',
    firstName: 'Asha',
    lastName: 'Rao',
    city: 'Pune',
    preferredLanguage: 'English',
    photoUrl: null,
    user: { phone: '+919800000001' },
    skills: [{ name: 'SQL' }, { name: 'Excel' }, { name: 'Python' }],
    education: [{ qualification: 'B.Sc Computer Science', institution: 'Test College', yearCompleted: 2024 }],
    experiences: [{ company: 'Acme', jobTitle: 'Support Intern', description: 'Handled customer tickets.', isInternship: true }],
  };
  const passportBefore = JSON.stringify(passport);
  const passportWrites: string[] = [];
  const writeSpy = (model: string) =>
    Object.fromEntries(
      ['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'].map((op) => [
        op,
        async () => {
          passportWrites.push(`${model}.${op}`);
          return {};
        },
      ]),
    );
  const resumes: Row[] = [];
  const resume = {
    create: async ({ data }: { data: Row }) => {
      const row = { id: `res-${resumes.length + 1}`, archivedAt: null, rawText: null, processingStatus: null, updatedAt: new Date(), ...data };
      resumes.push(row);
      return { ...row };
    },
    findFirst: async ({ where }: { where: Row }) =>
      resumes.find((r) => r.id === where.id && r.candidateId === where.candidateId && r.archivedAt === null) ?? null,
    findUniqueOrThrow: async ({ where }: { where: Row }) => ({ ...resumes.find((r) => r.id === where.id)! }),
    update: async ({ where, data }: { where: Row; data: Row }) => {
      const row = resumes.find((r) => r.id === where.id)!;
      Object.assign(row, data, { updatedAt: new Date() });
      return { ...row };
    },
    updateMany: async ({ where, data }: { where: Row; data: Row }) => {
      const row = resumes.find((r) => r.id === where.id);
      if (row) Object.assign(row, data);
      return { count: row ? 1 : 0 };
    },
    count: async () => resumes.length,
  };
  const analysisModel = { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }), upsert: async () => ({}) };
  const tx = { $queryRaw: async () => [], resume, resumeIssue: analysisModel, resumeFact: analysisModel, resumeAtsReport: analysisModel };
  const prisma = {
    ...tx,
    candidate: {
      findUnique: async () => JSON.parse(passportBefore),
      ...writeSpy('candidate'),
    },
    candidateSkill: writeSpy('candidateSkill'),
    education: writeSpy('education'),
    experience: writeSpy('experience'),
    $transaction: async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (client: typeof tx) => Promise<unknown>)(tx),
  };
  const service = new ResumesService(
    prisma as never,
    new IntelligenceService(),
    {} as never,
    {} as never,
    { isConfigured: () => false } as never,
    {} as never,
    { reindexIfStale: async () => undefined } as never,
    { get: () => undefined } as never,
  );
  (service as unknown as { safeSyncPdfForResume: () => Promise<null> }).safeSyncPdfForResume = async () => null;
  return { service, resumes, passport, passportBefore, passportWrites, prisma };
}

test('CP-10: resume generated from Career Passport data is an independent copy; editing it never modifies the passport', async () => {
  const h = harness();

  const created = await h.service.create('user-a', { targetJobTitle: 'Data Analyst' });
  const stored = h.resumes.find((r) => r.id === created.id)!;
  const content = JSON.parse(stored.contentJson);
  assert.equal(content.fullName, 'Asha Rao');
  assert.equal(content.city, 'Pune');
  assert.equal(content.phone, '+919800000001');
  assert.deepEqual(content.skills, ['SQL', 'Excel', 'Python']);
  assert.deepEqual(content.education, h.passport.education);
  assert.deepEqual(content.experiences, h.passport.experiences);
  assert.deepEqual(content.languages, ['English']);

  const edited = {
    ...content,
    summary: 'Analyst focused on SQL reporting for operations teams.',
    skills: [...content.skills, 'Power BI'],
    experiences: [{ ...content.experiences[0], description: 'Resolved 40+ customer tickets a day.' }],
  };
  await h.service.update('user-a', created.id, { content: edited });
  const after = JSON.parse(h.resumes.find((r) => r.id === created.id)!.contentJson);
  assert.equal(after.summary, edited.summary);
  assert.deepEqual(after.skills, ['SQL', 'Excel', 'Python', 'Power BI']);
  assert.equal(after.experiences[0].description, 'Resolved 40+ customer tickets a day.');

  assert.deepEqual(h.passportWrites, [], 'resume create/edit must not write any Career Passport table');
  assert.equal(JSON.stringify(await h.prisma.candidate.findUnique()), h.passportBefore, 'Career Passport unchanged');

  const second = await h.service.create('user-a', { targetJobTitle: 'Data Analyst' });
  const secondContent = JSON.parse(h.resumes.find((r) => r.id === second.id)!.contentJson);
  assert.deepEqual(secondContent.skills, ['SQL', 'Excel', 'Python'], 'a new version is generated from the unchanged passport');
  assert.equal(secondContent.experiences[0].description, 'Handled customer tickets.');
  const firstAgain = JSON.parse(h.resumes.find((r) => r.id === created.id)!.contentJson);
  assert.equal(firstAgain.summary, edited.summary, 'generating another version does not change the edited one');
});
