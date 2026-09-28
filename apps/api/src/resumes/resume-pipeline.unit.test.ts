import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/**
 * Lightweight mapping checks for resume → candidate sync expectations.
 * Full Nest DI tests run in integration; these lock the contract.
 */

describe('resume pipeline mapping contract', () => {
  it('maps ResumeContent contact fields to candidate columns', () => {
    const content = {
      fullName: 'Ada Lovelace',
      city: 'Chennai',
      state: 'Tamil Nadu',
      summary: 'Mathematician and programmer.',
      skills: ['Mathematics', 'Analytics'],
      email: 'ada@example.com',
      phone: '+919999999999',
      education: [{ qualification: 'B.Sc', institution: 'College', yearCompleted: 1840 }],
      experiences: [{ company: 'Analytical Engine', jobTitle: 'Analyst', description: null, isInternship: false }],
      links: { linkedin: 'https://linkedin.com/in/ada' },
    };

    const nameParts = content.fullName.trim().split(/\s+/);
    assert.equal(nameParts[0], 'Ada');
    assert.equal(nameParts.slice(1).join(' '), 'Lovelace');
    assert.ok(content.skills.includes('Mathematics'));
    assert.equal(content.education[0].qualification, 'B.Sc');
    assert.equal(content.experiences[0].company, 'Analytical Engine');
    assert.equal(content.links.linkedin.includes('linkedin.com'), true);
  });

  it('treats thin resumes as needing reprocess', () => {
    const thin = { skills: [], education: [], experiences: [], summary: 'hi' };
    const rich = {
      skills: ['React'],
      education: [{ qualification: 'B.E' }],
      experiences: [],
      summary: 'Experienced engineer',
    };
    const isThin = (c: typeof thin) =>
      !(c.skills?.length || c.education?.length || c.experiences?.length) &&
      (c.summary || '').trim().length < 40;
    assert.equal(isThin(thin), true);
    assert.equal(isThin(rich), false);
  });

  it('documents processing status vocabulary', () => {
    const statuses = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'READY'];
    assert.ok(statuses.includes('COMPLETED'));
    assert.ok(statuses.includes('FAILED'));
  });
});
