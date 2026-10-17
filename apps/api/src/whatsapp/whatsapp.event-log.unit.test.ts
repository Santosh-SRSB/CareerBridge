/**
 * In-memory WhatsApp console ids. Run with the WhatsApp unit script.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WhatsAppEventLog } from './whatsapp.event-log.ts';

describe('WhatsApp event log ids', () => {
  it('uses a unique timestamp-hex id and keeps the newest entry first', () => {
    const log = new WhatsAppEventLog();
    const first = log.push({ kind: 'INFO', summary: 'first' });
    const second = log.push({ kind: 'INFO', summary: 'second' });
    assert.match(first.id, /^\d+-[0-9a-f]{8}$/);
    assert.match(second.id, /^\d+-[0-9a-f]{8}$/);
    assert.notEqual(first.id, second.id);
    assert.equal(log.list(2)[0]?.id, second.id);
  });
});
