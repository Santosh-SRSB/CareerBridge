/**
 * Unit tests for grounding gate + experience-year computation (slice A–D).
 * Run: node -r ts-node/register/transpile-only --test src/resumes/content-grounding-gate.unit.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ResumeContent } from '@careerbridge/shared';
import { applyContentGroundingGate } from './content-grounding-gate';
import { computeTotalExperienceYears } from './experience-years';

const base: ResumeContent = {
  fullName: 'Candidate',
  city: null,
  phone: null,
  email: null,
  summary: '',
  skills: [],
  education: [],
  experiences: [],
  languages: [],
};

describe('content grounding gate', () => {
  it('rejects a foreign name and contaminated education/skills/languages', () => {
    const raw = `
Nagendra Mahto
nagendra@mail.com
Product Manager with 17 years experience
MCA from Example University
Skills: iOS, Swift, Product Strategy
Languages: English, Hindi
`;
    const polluted: ResumeContent = {
      ...base,
      fullName: 'Keerthi.S',
      skills: ['Sourcing', 'Screening', 'iOS'],
      education: [
        { qualification: 'PUC', institution: null, yearCompleted: null },
        { qualification: 'MCA', institution: 'Example University', yearCompleted: null },
      ],
      languages: ['Konkani', 'Kannada', 'English'],
    };
    const { content, rejected } = applyContentGroundingGate(polluted, raw);
    assert.equal(content.fullName, 'Candidate');
    assert.ok(rejected.some((r) => r.field === 'fullName' && /keerthi/i.test(r.value)));
    assert.ok(content.skills.includes('iOS'));
    assert.ok(!content.skills.includes('Sourcing'));
    assert.ok(content.education.some((e) => /MCA/i.test(e.qualification)));
    assert.ok(!content.education.some((e) => /PUC/i.test(e.qualification)));
    assert.ok(content.languages.includes('English'));
    assert.ok(!content.languages.includes('Konkani'));
  });

  it('keeps a grounded name', () => {
    const raw = 'Nagendra Mahto\nProduct Manager';
    const { content, rejected } = applyContentGroundingGate(
      { ...base, fullName: 'Nagendra Mahto' },
      raw,
    );
    assert.equal(content.fullName, 'Nagendra Mahto');
    assert.ok(!rejected.some((r) => r.field === 'fullName'));
  });
});

describe('computeTotalExperienceYears', () => {
  it('computes ~17 years from dated span', () => {
    const { years } = computeTotalExperienceYears(
      [
        {
          jobTitle: 'Engineer',
          company: 'A',
          description: null,
          isInternship: false,
          startDate: '2009-01',
          endDate: null,
          isCurrent: true,
        },
      ],
      new Date('2026-04-01'),
    );
    assert.ok(years >= 16 && years <= 18, `got ${years}`);
  });

  it('does not invent years when dates are missing', () => {
    const { years, confidence } = computeTotalExperienceYears([
      { jobTitle: 'PM', company: 'X', description: null, isInternship: false },
    ]);
    assert.equal(years, 0);
    assert.ok(confidence < 0.3);
  });
});
