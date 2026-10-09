import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryIconName } from './onboarding-category-icon';
import { SETUP_TASKS, setupTaskStatus } from './onboarding-setup';

test('job category labels map to the reference icons', () => {
  assert.equal(categoryIconName('Technology'), 'code');
  assert.equal(categoryIconName('Software Development'), 'code');
  assert.equal(categoryIconName('Data / Analytics'), 'data');
  assert.equal(categoryIconName('IT Support'), 'headset');
  assert.equal(categoryIconName('Product / Design'), 'design');
  assert.equal(categoryIconName('Engineering'), 'engineering');
  assert.equal(categoryIconName('Cybersecurity'), 'shield');
  assert.equal(categoryIconName('QA / Testing'), 'test');
  assert.equal(categoryIconName('Marketing'), 'marketing');
  assert.equal(categoryIconName('Sales'), 'arrow');
  assert.equal(categoryIconName('Human Resources'), 'people');
  assert.equal(categoryIconName('Hospitality'), 'briefcase');
});

test('setup screen advances on the timer but waits for the profile before finishing', () => {
  const last = SETUP_TASKS.length - 1;
  assert.equal(setupTaskStatus(0, false), 0);
  assert.equal(setupTaskStatus(2, true), 2);
  assert.equal(setupTaskStatus(last, false), last);
  assert.equal(setupTaskStatus(last + 5, false), last);
  assert.equal(setupTaskStatus(last, true), SETUP_TASKS.length);
  assert.equal(setupTaskStatus(-3, true), 0);
});
