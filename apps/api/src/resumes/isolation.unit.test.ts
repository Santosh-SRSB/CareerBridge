/**
 * Task E — data isolation regression.
 * Two distinct resume texts processed sequentially and concurrently must never
 * share identity / education / skills / languages fields.
 *
 * Run: npm.cmd run test:resume-isolation -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseExtractedResumeText } from './parse-extracted-resume';
import { applyContentGroundingGate } from './content-grounding-gate';
import { GCS_RESUMES_FOLDER } from '../common/storage/storage.service';

const NAGENDRA_TEXT = `
Nagendra Mahto
nagendra.mahto@example.com | Bengaluru, Karnataka

SUMMARY
Product Manager and iOS Architect with deep mobile platform experience.

WORK EXPERIENCE
Product Manager
Acme Mobile Labs
Jan 2009 - Present
- Led iOS product strategy and roadmap for consumer apps
- Owned Swift architecture decisions across squads

EDUCATION
MCA
Example Institute of Technology
2008
BCA
City College
2005

SKILLS
iOS, Swift, Product Strategy, Roadmapping, Stakeholder Management

LANGUAGES
English, Hindi
`;

const KEERTHI_TEXT = `
Keerthi.S
keerthi.s@example.com | Bengaluru, Karnataka

SUMMARY
IT Recruiter specializing in technical hiring.

WORK EXPERIENCE
IT Recruiter
Synczi Consulting Services
Oct 2020 - Apr 2022
- Sourcing and Screening candidates
- Interview Scheduling for client panels

Team Lead
Infinite Potential Digital Marketing
Jun 2023 - Present
- Managed end-to-end hiring pipeline

EDUCATION
PUC
Vasavi Vidyanikethan College
BCom
Vasavi Vidyanikethan College
2020

SKILLS
Sourcing, Screening, Interview Scheduling, Talent Acquisition

LANGUAGES
Hindi, English, Konkani, Kannada
`;

function processIsolated(raw: string) {
  const parsed = parseExtractedResumeText(raw);
  return applyContentGroundingGate(parsed, raw).content;
}

function assertDisjoint(a: ReturnType<typeof processIsolated>, b: ReturnType<typeof processIsolated>) {
  assert.match(a.fullName, /Nagendra/i);
  assert.match(b.fullName, /Keerthi/i);
  assert.notEqual(a.fullName.toLowerCase(), b.fullName.toLowerCase());

  assert.ok(a.skills.some((s) => /ios|swift|product/i.test(s)));
  assert.ok(b.skills.some((s) => /sourcing|screening|interview/i.test(s)));
  assert.ok(a.skills.every((s) => !/sourcing|screening|interview scheduling/i.test(s)));
  assert.ok(b.skills.every((s) => !/\bios\b|swift|product strategy/i.test(s)));

  assert.ok(a.education.some((e) => /mca|bca/i.test(e.qualification)));
  assert.ok(b.education.some((e) => /puc|bcom|b\.?\s*com/i.test(e.qualification)));
  assert.ok(a.education.every((e) => !/puc|bcom/i.test(e.qualification)));
  assert.ok(b.education.every((e) => !/\bmca\b|\bbca\b/i.test(e.qualification)));

  assert.ok(a.languages.every((l) => !/konkani|kannada/i.test(l)));
  assert.ok(b.languages.some((l) => /konkani|kannada/i.test(l)));
}

describe('E — sequential isolation', () => {
  it('second parse does not retain fields from the first', () => {
    const first = processIsolated(NAGENDRA_TEXT);
    const second = processIsolated(KEERTHI_TEXT);
    assertDisjoint(first, second);

    // Reverse order — still isolated
    const againA = processIsolated(NAGENDRA_TEXT);
    assert.match(againA.fullName, /Nagendra/i);
    assert.ok(againA.skills.every((s) => !/sourcing|screening/i.test(s)));
  });
});

describe('E — concurrent isolation (Promise.all)', () => {
  it('parallel parses never share fields', async () => {
    const [a, b] = await Promise.all([
      Promise.resolve().then(() => processIsolated(NAGENDRA_TEXT)),
      Promise.resolve().then(() => processIsolated(KEERTHI_TEXT)),
    ]);
    assertDisjoint(a, b);
  });

  it('many interleaved concurrent runs stay isolated', async () => {
    const runs = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        Promise.resolve().then(() => processIsolated(i % 2 === 0 ? NAGENDRA_TEXT : KEERTHI_TEXT)),
      ),
    );
    for (let i = 0; i < runs.length; i += 1) {
      if (i % 2 === 0) {
        assert.match(runs[i].fullName, /Nagendra/i);
        assert.ok(runs[i].skills.every((s) => !/sourcing|screening/i.test(s)));
      } else {
        assert.match(runs[i].fullName, /Keerthi/i);
        assert.ok(runs[i].skills.every((s) => !/\bios\b|swift/i.test(s)));
      }
    }
  });
});

describe('E — GCS object key uniqueness', () => {
  it('full resumeIds produce distinct paths for the same filename', () => {
    // Mirror StorageService.resumeObjectPath logic (no Nest DI needed).
    const build = (fileName: string, uniquePart: string) => {
      const cleaned = fileName.replace(/[^\w.\-]+/g, '_');
      const lastDot = cleaned.lastIndexOf('.');
      const base = lastDot > 0 ? cleaned.slice(0, lastDot) : cleaned;
      const ext = lastDot > 0 ? cleaned.slice(lastDot) : '';
      const unique = uniquePart.replace(/[^\w.\-]+/g, '_').slice(0, 64);
      return `${GCS_RESUMES_FOLDER}/${base}-${unique}${ext}`;
    };
    const idA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const idB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const pathA = build('IT-Resume.pdf', idA);
    const pathB = build('IT-Resume.pdf', idB);
    assert.notEqual(pathA, pathB);
    assert.match(pathA, /aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/);
    assert.doesNotMatch(pathA, /aaaaaaaa$/); // must not be truncated to 8 hex chars only
    assert.ok(pathA.length > `resumes/IT-Resume-aaaaaaaa.pdf`.length);
  });
});
