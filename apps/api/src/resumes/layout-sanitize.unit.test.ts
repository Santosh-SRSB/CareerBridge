import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  reassociateOrphanedRoles,
  sanitizeExtractedResumeText,
  sanitizeResumeDate,
  stitchPlainWraps,
  stripArtifactNoise,
} from './layout-sanitize';
import { coerceParsedResumeSchema } from './parsed-resume.schema';
import { reconstructSpatialReadingOrder } from './spatial-pdf-layout';

describe('layout-sanitize', () => {
  it('strips OCR / TeX-like artifacts', () => {
    const cleaned = stripArtifactNoise('Hello $=8$ world â€¢ [image] test');
    assert.doesNotMatch(cleaned, /\$=8\$/);
    assert.doesNotMatch(cleaned, /\[image\]/i);
    assert.match(cleaned, /Hello/);
    assert.match(cleaned, /world/);
  });

  it('stitches mid-sentence plain wraps', () => {
    const lines = stitchPlainWraps([
      'Built end-to-end hiring pipelines including',
      'screening and social sourcing.',
    ]);
    assert.equal(lines.length, 1);
    assert.match(lines[0], /pipelines including screening/);
  });

  it('reassociates orphaned role titles with company', () => {
    const lines = reassociateOrphanedRoles([
      'Acme Technologies Pvt. Ltd.',
      'Bengaluru',
      'Technical Architect',
      'Jan 2020 - Present',
      '• Led platform delivery',
    ]);
    const joined = lines.join('\n');
    assert.match(joined, /Acme Technologies[\s\S]*Technical Architect[\s\S]*Jan 2020/);
  });

  it('sanitizes invalid calendar dates to month/year', () => {
    const fixed = sanitizeResumeDate('30th Feb 2020');
    assert.ok(fixed);
    assert.doesNotMatch(fixed, /30/);
    assert.match(fixed, /2020/);
  });

  it('marks PRESENT for current roles', () => {
    assert.equal(sanitizeResumeDate('till date'), 'PRESENT');
    assert.equal(sanitizeResumeDate('Present'), 'PRESENT');
  });

  it('runs full text sanitation pipeline', () => {
    const text = sanitizeExtractedResumeText(
      'Nagendra Mahto\nAcme Softwares Pvt. Ltd.\nnoise\nFounder & CEO\nJan 2019 - Present\n• Delivered\n• quality products\nin time.',
    );
    assert.match(text, /Nagendra/);
    assert.match(text, /Founder/);
  });
});

describe('parsed-resume.schema coerce', () => {
  it('coerces partial / malformed JSON without throwing', () => {
    const { data, warnings, partial } = coerceParsedResumeSchema({
      personal_info: { full_name: 'Ada Lovelace' },
      work_experience: 'not-an-array',
      skills: 'React, Node',
    });
    assert.equal(data.personal_info.full_name, 'Ada Lovelace');
    assert.deepEqual(data.skills, ['React', 'Node']);
    assert.ok(warnings.includes('work_experience_not_array'));
    assert.equal(partial, true);
  });

  it('accepts legacy camelCase experience keys', () => {
    const { data } = coerceParsedResumeSchema({
      personalInfo: { fullName: 'Test User', email: 't@x.com' },
      experience: [{ company: 'Co', jobTitle: 'Dev', startDate: '2020', endDate: 'Present' }],
    });
    assert.equal(data.personal_info.full_name, 'Test User');
    assert.equal(data.work_experience[0]?.role_title, 'Dev');
  });
});

describe('spatial-pdf-layout', () => {
  it('reads two-column pages main-then-sidebar (not interleaved)', () => {
    const page = [
      'Jane Doe\tjane@mail.com',
      'WORK EXPERIENCE\tSKILLS',
      'Engineer at Acme\tReact',
      'Built APIs\tNode',
    ].join('\n');
    const result = reconstructSpatialReadingOrder([{ num: 1, text: page }]);
    assert.ok(result.notes.some((n) => /two-column/i.test(n)));
    // Skills should appear after experience block, not between job lines
    const idxExp = result.text.indexOf('Engineer at Acme');
    const idxBuilt = result.text.indexOf('Built APIs');
    const idxReact = result.text.indexOf('React');
    assert.ok(idxExp >= 0 && idxBuilt >= 0 && idxReact >= 0);
    assert.ok(idxExp < idxBuilt);
    assert.ok(idxBuilt < idxReact || idxReact > idxExp);
  });
});
