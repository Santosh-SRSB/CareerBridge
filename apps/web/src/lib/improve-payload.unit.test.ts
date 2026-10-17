import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IMPROVE_BULLET_MAX, IMPROVE_BULLETS_MAX, fitAvoidList, fitExperienceBullets } from './improve-payload';

describe('fitExperienceBullets', () => {
  it('keeps short bullets unchanged and drops blanks', () => {
    assert.deepEqual(fitExperienceBullets(['  Built APIs ', '', 'Led a team of 4']), ['Built APIs', 'Led a team of 4']);
  });

  it('splits a long paragraph at sentence boundaries without losing text', () => {
    const sentence = 'Designed and delivered customer-facing web and mobile applications for healthcare clients.';
    const paragraph = Array(6).fill(sentence).join(' ');
    assert.ok(paragraph.length > IMPROVE_BULLET_MAX);
    const out = fitExperienceBullets([paragraph]);
    assert.ok(out.length > 1);
    assert.ok(out.every((b) => b.length <= IMPROVE_BULLET_MAX));
    assert.equal(out.join(' '), paragraph);
  });

  it('splits a single over-long sentence at word boundaries', () => {
    const words = Array(80).fill('integration').join(' ');
    const out = fitExperienceBullets([words]);
    assert.ok(out.every((b) => b.length <= IMPROVE_BULLET_MAX));
    assert.equal(out.join(' '), words);
  });

  it('caps the number of bullets', () => {
    const out = fitExperienceBullets(Array(20).fill('Handled support tickets'));
    assert.equal(out.length, IMPROVE_BULLETS_MAX);
  });
});

describe('fitAvoidList', () => {
  it('returns undefined for empty input and trims entries', () => {
    assert.equal(fitAvoidList([]), undefined);
    assert.equal(fitAvoidList(['  ']), undefined);
    assert.deepEqual(fitAvoidList([' a ']), ['a']);
  });
});
