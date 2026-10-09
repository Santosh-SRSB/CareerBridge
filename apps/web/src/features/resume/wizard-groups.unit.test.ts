import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LAST_WIZARD_GROUP,
  profileCompletionPercent,
  wizardGroupFirstStep,
  wizardGroupFormSteps,
  wizardGroupIndex,
  type ProfileCompletionInput,
} from './wizard-groups';

const EMPTY: ProfileCompletionInput = {
  fullName: '',
  email: '',
  phone: '',
  state: '',
  city: '',
  summary: '',
  linkedin: '',
  github: '',
  portfolio: '',
  preferredRole: '',
  preferredLocation: '',
  expectedSalary: '',
  education: [],
  experience: [],
  projects: [],
  certifications: [],
  achievements: [],
  skills: [],
  languages: [],
};

test('every wizard step maps to one of the four sections', () => {
  assert.equal(wizardGroupIndex('Personal'), 0);
  assert.equal(wizardGroupIndex('Education'), 1);
  assert.equal(wizardGroupIndex('Experience'), 1);
  assert.equal(wizardGroupIndex('Skills'), 2);
  assert.equal(wizardGroupIndex('Credentials'), 2);
  assert.equal(wizardGroupIndex('Links'), 3);
  assert.equal(wizardGroupIndex('Career Gap'), 3);
  assert.equal(wizardGroupIndex('Review'), LAST_WIZARD_GROUP);
  assert.equal(wizardGroupIndex('Unknown'), 0);
});

test('section form steps hide Career Gap unless a gap exists and never include Review', () => {
  assert.deepEqual(wizardGroupFormSteps(1, false), ['Education', 'Experience']);
  assert.deepEqual(wizardGroupFormSteps(3, false), ['Links']);
  assert.deepEqual(wizardGroupFormSteps(3, true), ['Links', 'Career Gap']);
});

test('first step of a section is where sidebar and Back navigation land', () => {
  assert.equal(wizardGroupFirstStep(0), 'Personal');
  assert.equal(wizardGroupFirstStep(2), 'Skills');
  assert.equal(wizardGroupFirstStep(99), 'Links');
  assert.equal(wizardGroupFirstStep(-1), 'Personal');
});

test('profile completion counts only fields with real content', () => {
  assert.equal(profileCompletionPercent(EMPTY), 0);
  assert.equal(profileCompletionPercent({ ...EMPTY, fullName: '   ', skills: [] }), 0);
  const partial = profileCompletionPercent({
    ...EMPTY,
    fullName: 'Asha',
    email: 'asha@example.com',
    phone: '9876543210',
    state: 'Karnataka',
    city: 'Bengaluru',
    summary: 'Analyst',
    education: [{}],
  });
  assert.equal(partial, 37);
  const full = profileCompletionPercent({
    fullName: 'a',
    email: 'b',
    phone: 'c',
    state: 'd',
    city: 'e',
    summary: 'f',
    linkedin: 'g',
    github: 'h',
    portfolio: 'i',
    preferredRole: 'j',
    preferredLocation: 'k',
    expectedSalary: 'l',
    education: [1],
    experience: [1],
    projects: [1],
    certifications: [1],
    achievements: [1],
    skills: [1],
    languages: [1],
  });
  assert.equal(full, 100);
});
