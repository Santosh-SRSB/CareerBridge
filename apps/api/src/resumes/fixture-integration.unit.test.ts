/**
 * Task F — fixture-wired integration test.
 *
 * Expected files (place either at repo root or under apps/api):
 *   test/fixtures/original-resume.pdf          → Nagendra original upload
 *   test/fixtures/portal-downloaded-resume.pdf → corrupted portal download (Keerthi-shaped)
 *
 * When both PDFs are present: extract → parse → grounding gate, then assert
 * original stays Nagendra-like and does NOT pick up portal-download contaminants.
 * When missing: tests are skipped (not failed) so CI stays green until fixtures land.
 *
 * Run: npm.cmd run test:resume-fixtures -w api
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ResumeExtractorService } from './resume-extractor.service';
import { parseExtractedResumeText } from './parse-extracted-resume';
import { applyContentGroundingGate } from './content-grounding-gate';
import { computeTotalExperienceYears } from './experience-years';

function resolveFixture(name: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'test', 'fixtures', name),
    path.resolve(process.cwd(), '..', '..', 'test', 'fixtures', name),
    path.resolve(__dirname, '..', '..', 'test', 'fixtures', name),
    path.resolve(__dirname, '..', '..', '..', '..', 'test', 'fixtures', name),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p) && fs.statSync(p).size > 100) return p;
  }
  return null;
}

const ORIGINAL = resolveFixture('original-resume.pdf');
const PORTAL = resolveFixture('portal-downloaded-resume.pdf');
const HAS_DOC_AI = Boolean(process.env.DOCUMENT_AI_PROCESSOR_ID && process.env.GCP_PROJECT_ID);
const HAS_FIXTURES = Boolean(ORIGINAL && PORTAL && HAS_DOC_AI);

async function extractAndGate(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  // Minimal ConfigService stub — extractor only needs env lookups for Document AI / OCR gates.
  const config = {
    get: (_key: string, defaultValue?: string) => defaultValue ?? '',
  } as import('@nestjs/config').ConfigService;
  const extractor = new ResumeExtractorService(config);
  const extraction = await extractor.extract(buffer, 'application/pdf', path.basename(filePath));
  assert.ok(extraction.text.trim().length > 40, `empty extract from ${filePath}`);
  const parsed = parseExtractedResumeText(extraction.text);
  const gated = applyContentGroundingGate(parsed, extraction.text);
  return { extraction, content: gated.content, rejected: gated.rejected };
}

describe('F — fixture integration (original vs portal download)', () => {
  it('discovers fixture paths or skips clearly', () => {
    if (!ORIGINAL || !PORTAL) {
      console.log(
        '[skip] Place PDFs at test/fixtures/original-resume.pdf and test/fixtures/portal-downloaded-resume.pdf',
      );
    } else if (!HAS_DOC_AI) {
      console.log('[skip] Document AI only — set DOCUMENT_AI_PROCESSOR_ID and GCP_PROJECT_ID to run fixture extract');
    }
    assert.ok(true);
  });

  it(
    'original-resume.pdf extracts without portal-download contaminants',
    { skip: !HAS_FIXTURES },
    async () => {
      const { content, extraction } = await extractAndGate(ORIGINAL!);
      const blob = JSON.stringify(content).toLowerCase();
      const raw = extraction.text.toLowerCase();

      // Name should be Nagendra-like when present in the PDF text
      if (/nagendra/i.test(extraction.text)) {
        assert.match(content.fullName, /nagendra/i);
      }
      assert.doesNotMatch(content.fullName, /keerthi/i);

      // Must not absorb Keerthi-shaped fields from a parallel contaminated download
      assert.ok(!/keerthi\.?\s*s/i.test(blob));
      assert.ok(!content.skills.some((s) => /sourcing|screening|interview scheduling/i.test(s)));
      assert.ok(!content.education.some((e) => /\bpuc\b|\bbcom\b/i.test(e.qualification)));
      assert.ok(!content.languages.some((l) => /konkani|kannada/i.test(l)) || /konkani|kannada/i.test(raw));

      // Prefer MCA/BCA when those strings exist in source
      if (/\bmca\b/i.test(extraction.text)) {
        assert.ok(content.education.some((e) => /mca/i.test(e.qualification)));
      }

      const years = computeTotalExperienceYears(content.experiences);
      if (years.confidence >= 0.7) {
        assert.ok(years.years >= 10, `expected long tenure, got ${years.years}`);
      }
    },
  );

  it(
    'portal-downloaded-resume.pdf is treated as a separate extract (no bleed into original run)',
    { skip: !HAS_FIXTURES },
    async () => {
      const [orig, portal] = await Promise.all([
        extractAndGate(ORIGINAL!),
        extractAndGate(PORTAL!),
      ]);

      // Concurrent extract+gate must not mix outputs
      if (/nagendra/i.test(orig.extraction.text)) {
        assert.match(orig.content.fullName, /nagendra/i);
      }
      assert.notEqual(
        orig.content.fullName.toLowerCase(),
        portal.content.fullName.toLowerCase() || 'x',
      );

      // If portal PDF still contains Keerthi markers, grounding may strip them —
      // either way they must not appear on the original result.
      assert.ok(!orig.content.skills.some((s) => /sourcing|screening/i.test(s)));
      assert.ok(!/keerthi/i.test(orig.content.fullName));
    },
  );
});
