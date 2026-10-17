/**
 * Resume wizard → profile (Career Passport) mapping: experience dates + current flag, education dates + field of
 * study, and resume links merged into the profile links.
 */
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { before, test } from 'node:test';
import type { CandidateProfile, ResumeContent, SavePassportPayload } from '@careerbridge/shared';

type Lib = typeof import('./build-master-resume') &
  typeof import('./master-to-resume-content') &
  typeof import('./build-resume-from-resume-content') &
  typeof import('./resume-content-to-passport') &
  typeof import('./resume-profile-sync');
let lib: Lib;

before(async () => {
  // The mapping modules import through the Next.js `@/` alias, which plain Node does not know.
  const loader = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
  const resolve = loader._resolveFilename;
  const webSrc = path.resolve(__dirname, '..', '..');
  loader._resolveFilename = (request, ...rest) =>
    resolve(request.startsWith('@/') ? path.join(webSrc, request.slice(2)) : request, ...rest);
  lib = {
    ...(await import('./build-master-resume')),
    ...(await import('./master-to-resume-content')),
    ...(await import('./build-resume-from-resume-content')),
    ...(await import('./resume-content-to-passport')),
    ...(await import('./resume-profile-sync')),
  };
});

type WizardEducation = { degree: string; field?: string; institution: string; startDate: string; endDate: string; isCurrent?: boolean };
type WizardExperience = { role: string; company: string; startDate: string; endDate: string; isCurrent: boolean; isInternship?: boolean };

function wizardToPassport(education: WizardEducation[], experience: WizardExperience[] = []) {
  const master = lib.buildMasterResume({
    fullName: 'Wizard Tester',
    location: 'Bengaluru, Karnataka',
    linkedin: 'https://www.linkedin.com/in/wizard-tester',
    summary: 'Backend developer.',
    skills: ['TypeScript'],
    experienceList: experience.map((row) => ({ location: '', responsibilities: [], ...row })),
    educationList: education,
    projectList: [],
    certificationList: [],
    achievementList: [],
  });
  const content = lib.masterResumeToResumeContent(master);
  return { master, content, passport: lib.mapResumeContentToPassportPayload(content) };
}

function resumeContent(rows: Pick<ResumeContent, 'education' | 'experiences'>): ResumeContent {
  return { fullName: 'Wizard Tester', city: null, phone: null, summary: '', skills: [], languages: [], ...rows };
}

const BTECH: WizardEducation = {
  degree: 'B.Tech',
  field: 'Computer Science',
  institution: 'Example Institute of Technology',
  startDate: '2016-08',
  endDate: '2020-05',
};

test('experience: start date and currently-working flag reach the profile payload', () => {
  const { passport } = wizardToPassport([BTECH], [
    { role: 'Software Engineer', company: 'Acme Labs', startDate: '2023-01', endDate: '', isCurrent: true },
    { role: 'Junior Developer', company: 'Beta Corp', startDate: '2020-07', endDate: '2022-12', isCurrent: false },
  ]);
  assert.deepEqual(
    passport.experience?.map(({ company, startDate, endDate, stillInCompany }) => ({ company, startDate, endDate, stillInCompany })),
    [
      { company: 'Acme Labs', startDate: '2023-01', endDate: undefined, stillInCompany: true },
      { company: 'Beta Corp', startDate: '2020-07', endDate: '2022-12', stillInCompany: false },
    ],
  );
});

test('experience: missing or year-only dates are not invented', () => {
  const content = resumeContent({
    education: [],
    experiences: [
      { company: 'No Dates Co', jobTitle: 'Analyst', description: null, isInternship: false },
      { company: 'Year Only Co', jobTitle: 'Intern', description: null, isInternship: true, startDate: '2021', endDate: '2021' },
      { company: 'Display Form Co', jobTitle: 'Engineer', description: null, isInternship: false, startDate: 'JAN 2023', endDate: 'PRESENT', isCurrent: true },
    ],
  });
  const rows = lib.mapResumeContentToPassportPayload(content).experience || [];
  assert.deepEqual(
    rows.map(({ company, startDate, endDate, stillInCompany, isInternship }) => ({ company, startDate, endDate, stillInCompany, isInternship })),
    [
      { company: 'No Dates Co', startDate: undefined, endDate: undefined, stillInCompany: false, isInternship: false },
      { company: 'Display Form Co', startDate: '2023-01', endDate: undefined, stillInCompany: true, isInternship: false },
      { company: 'Year Only Co', startDate: '2021', endDate: '2021', stillInCompany: false, isInternship: true },
    ],
  );
});

test('education: start date, completion date and field of study are kept separately', () => {
  const { content, passport } = wizardToPassport([BTECH]);
  assert.deepEqual(content.education[0], {
    qualification: 'B.Tech in Computer Science',
    institution: 'Example Institute of Technology',
    yearCompleted: 2020,
    fieldOfStudy: 'Computer Science',
    startDate: '2016-08',
    endDate: '2020-05',
  });
  assert.deepEqual(passport.education, [
    {
      qualification: 'B.Tech in Computer Science',
      institution: 'Example Institute of Technology',
      fieldOfStudy: 'Computer Science',
      yearCompleted: '2020',
      startDate: '2016-08',
      endDate: '2020-05',
    },
  ]);
});

test('education: currently studying and missing optional fields', () => {
  const { passport } = wizardToPassport([
    { degree: 'M.Tech', institution: 'Example University', startDate: '2024-08', endDate: '2026-05', isCurrent: true },
    { degree: 'Class XII', institution: 'Example School', startDate: '', endDate: '' },
  ]);
  assert.deepEqual(passport.education, [
    {
      qualification: 'M.Tech',
      institution: 'Example University',
      fieldOfStudy: undefined,
      yearCompleted: undefined,
      startDate: '2024-08',
      endDate: undefined,
    },
    {
      qualification: 'Class XII',
      institution: 'Example School',
      fieldOfStudy: undefined,
      yearCompleted: undefined,
      startDate: undefined,
      endDate: undefined,
    },
  ]);
});

test('education: stored content with only a completion year keeps the existing mapping', () => {
  const content = resumeContent({
    experiences: [],
    education: [{ qualification: 'B.Com', institution: 'Example College', yearCompleted: 2019 }],
  });
  assert.deepEqual(lib.mapResumeContentToPassportPayload(content).education, [
    {
      qualification: 'B.Com',
      institution: 'Example College',
      fieldOfStudy: undefined,
      yearCompleted: '2019',
      startDate: undefined,
      endDate: '2019-06',
    },
  ]);
});

test('education: content → master → content round trip keeps dates and field of study', () => {
  const { content } = wizardToPassport([BTECH]);
  const rebuilt = lib.masterResumeToResumeContent(lib.buildResumeFromResumeContent(content));
  assert.deepEqual(rebuilt.education, content.education);
  assert.equal(lib.buildResumeFromResumeContent(content).education[0].degree, 'B.Tech');
});

test('links: LinkedIn from the resume is added to empty profile links', () => {
  assert.deepEqual(
    lib.mergeResumeLinksIntoProfile({}, { linkedin: 'www.linkedin.com/in/wizard-tester' }),
    { linkedin: 'https://www.linkedin.com/in/wizard-tester' },
  );
});

test('links: existing profile links are preserved and duplicates are not re-sent', () => {
  const existing = { github: 'https://github.com/wizard', website: 'https://wizard.example.com/' };
  assert.deepEqual(
    lib.mergeResumeLinksIntoProfile(existing, { linkedin: 'https://linkedin.com/in/wizard', github: 'github.com/wizard/' }),
    { ...existing, linkedin: 'https://linkedin.com/in/wizard' },
  );
  assert.equal(
    lib.mergeResumeLinksIntoProfile(
      { linkedin: 'https://www.linkedin.com/in/wizard-tester' },
      { linkedin: 'HTTPS://WWW.LINKEDIN.COM/in/wizard-tester/' },
    ),
    null,
  );
});

test('links: invalid or missing resume links never change the profile', () => {
  const existing = { linkedin: 'https://www.linkedin.com/in/kept' };
  assert.equal(lib.mergeResumeLinksIntoProfile(existing, { linkedin: 'https://example.com/in/not-linkedin' }), null);
  assert.equal(lib.mergeResumeLinksIntoProfile(existing, { linkedin: '', github: null, portfolio: '   ' }), null);
  assert.equal(lib.mergeResumeLinksIntoProfile(existing, { linkedin: `https://linkedin.com/in/${'a'.repeat(300)}` }), null);
});

test('links: an edited LinkedIn replaces the old one and keeps the other links', () => {
  assert.deepEqual(
    lib.mergeResumeLinksIntoProfile(
      { linkedin: 'https://www.linkedin.com/in/old', portfolio: 'https://me.example.com/' },
      { linkedin: 'https://www.linkedin.com/in/new' },
    ),
    { linkedin: 'https://www.linkedin.com/in/new', portfolio: 'https://me.example.com/' },
  );
});

test('wizard profile save keeps onboarding experience years and follows the wizard gap state', () => {
  const base = lib.mapResumeContentToPassportPayload(resumeContent({ education: [], experiences: [] }));
  const noGap = lib.withPreservedProfileFields(base, { totalExperienceYears: 3, totalExperienceMonths: 0, gapReason: 'Old gap' }, {
    hasGap: false,
    gapMonths: 0,
    gapReason: 'stale text',
  });
  assert.equal(noGap.totalExperienceYears, '3');
  assert.equal(noGap.totalExperienceMonths, '0');
  assert.equal('gapReason' in noGap, false);
  assert.equal('gapMonths' in noGap, false);

  const withGap = lib.withPreservedProfileFields(base, null, { hasGap: true, gapMonths: 14.6, gapReason: '  Family care  ' });
  assert.equal('totalExperienceYears' in withGap, false);
  assert.equal(withGap.gapReason, 'Family care');
  assert.equal(withGap.gapMonths, 14);
  assert.equal(lib.withPreservedProfileFields(base, null, { hasGap: true, gapMonths: 900, gapReason: '' }).gapMonths, 600);
});

const EXISTING_PROFILE = {
  firstName: 'Wizard',
  totalExperienceYears: 3,
  totalExperienceMonths: 4,
  gapReason: 'Caring for a family member',
  gapMonths: 14,
  links: {},
} as unknown as CandidateProfile;

test('resume edit save: existing experience years and gap explanation stay when the resume omits them', () => {
  const base = lib.mapResumeContentToPassportPayload(resumeContent({ education: [], experiences: [] }));
  const saved = lib.withPreservedProfileFields(base, EXISTING_PROFILE);
  assert.equal(saved.totalExperienceYears, '3');
  assert.equal(saved.totalExperienceMonths, '4');
  assert.equal(saved.gapReason, 'Caring for a family member');
  assert.equal(saved.gapMonths, 14);
});

test('resume edit save: explicit payload values are not overwritten by the existing profile', () => {
  const base = lib.mapResumeContentToPassportPayload(resumeContent({ education: [], experiences: [] }));
  const explicit = { ...base, totalExperienceYears: '5', totalExperienceMonths: '2', gapReason: 'Higher studies', gapMonths: 6 };
  const saved = lib.withPreservedProfileFields(explicit, EXISTING_PROFILE);
  assert.equal(saved.totalExperienceYears, '5');
  assert.equal(saved.totalExperienceMonths, '2');
  assert.equal(saved.gapReason, 'Higher studies');
  assert.equal(saved.gapMonths, 6);
});

test('resume edit save: missing or unusable profile values are not invented', () => {
  const base = lib.mapResumeContentToPassportPayload(resumeContent({ education: [], experiences: [] }));
  assert.deepEqual(lib.withPreservedProfileFields(base, null), base);
  assert.deepEqual(lib.withPreservedProfileFields(base, undefined), base);
  assert.deepEqual(
    lib.withPreservedProfileFields(base, { totalExperienceYears: Number.NaN, totalExperienceMonths: -1, gapReason: '   ', gapMonths: null }),
    base,
  );
  assert.equal(lib.withPreservedProfileFields(base, { gapReason: null, gapMonths: 0 }).gapMonths, 0);
  assert.equal(lib.withPreservedProfileFields(base, { gapMonths: 900 }).gapMonths, 600);
});

function fakeProfileApi(read: () => Promise<CandidateProfile | null>) {
  const saved: SavePassportPayload[] = [];
  return {
    saved,
    api: {
      getCandidateMe: read,
      savePassport: async (payload: SavePassportPayload) => {
        saved.push(payload);
        return { ...EXISTING_PROFILE, firstName: payload.firstName } as CandidateProfile;
      },
    },
  };
}

const EDITED_RESUME = () =>
  resumeContent({
    education: [{ qualification: 'B.Com', institution: 'Example College', yearCompleted: 2019 }],
    experiences: [
      { company: 'Acme Labs', jobTitle: 'Analyst', description: null, isInternship: false, startDate: '2021-03', endDate: null, isCurrent: true },
    ],
  });

test('syncResumeToProfile reads the profile first and saves the resume with preserved values', async () => {
  const order: string[] = [];
  const fake = fakeProfileApi(async () => {
    order.push('read');
    return EXISTING_PROFILE;
  });
  const save = fake.api.savePassport;
  fake.api.savePassport = async (payload) => {
    order.push('save');
    return save(payload);
  };
  const { profile, existing } = await lib.syncResumeToProfile(EDITED_RESUME(), fake.api);
  assert.deepEqual(order, ['read', 'save']);
  assert.equal(existing, EXISTING_PROFILE);
  assert.equal(profile.firstName, 'Wizard');
  assert.equal(fake.saved.length, 1);
  const [payload] = fake.saved;
  assert.equal(payload.totalExperienceYears, '3');
  assert.equal(payload.gapReason, 'Caring for a family member');
  assert.equal(payload.gapMonths, 14);
  assert.deepEqual(
    payload.experience?.map(({ company, startDate, stillInCompany }) => ({ company, startDate, stillInCompany })),
    [{ company: 'Acme Labs', startDate: '2021-03', stillInCompany: true }],
  );
  assert.equal(payload.education?.[0].endDate, '2019-06');
});

test('syncResumeToProfile does not save when the profile read fails', async () => {
  const fake = fakeProfileApi(async () => {
    throw new Error('network down');
  });
  await assert.rejects(lib.syncResumeToProfile(EDITED_RESUME(), fake.api), /network down/);
  assert.equal(fake.saved.length, 0);
});

test('syncResumeToProfile with no stored profile saves only what the resume holds', async () => {
  const fake = fakeProfileApi(async () => null);
  const { existing } = await lib.syncResumeToProfile(EDITED_RESUME(), fake.api);
  assert.equal(existing, null);
  assert.deepEqual(fake.saved, [lib.mapResumeContentToPassportPayload(EDITED_RESUME())]);
});
