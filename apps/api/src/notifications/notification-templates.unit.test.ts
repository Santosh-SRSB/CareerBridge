/**
 * Notification templates: built-in defaults and admin overrides (in-memory Prisma double, no push).
 * Run: npm.cmd run test:admin -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { renderDefaultNotification } from './notification-templates';

type TemplateRow = { key: string; title: string; body: string; active: boolean; updatedBy: string | null; updatedAt: Date };

function harness() {
  const templates = new Map<string, TemplateRow>();
  const created: Array<{ title: string; body: string }> = [];
  const audits: string[] = [];
  const prisma = {
    notification: {
      create: async ({ data }: { data: { title: string; body: string } }) => {
        created.push({ title: data.title, body: data.body });
        return { id: `n${created.length}`, ...data };
      },
    },
    notificationTemplate: {
      findUnique: async ({ where }: { where: { key: string } }) => templates.get(where.key) ?? null,
      findMany: async () => [...templates.values()],
      upsert: async ({ where, create, update }: { where: { key: string }; create: TemplateRow; update: Partial<TemplateRow> }) => {
        const prev = templates.get(where.key);
        const row = { ...(prev ?? create), ...(prev ? update : {}), updatedAt: new Date() } as TemplateRow;
        templates.set(where.key, row);
        return row;
      },
      delete: async ({ where }: { where: { key: string } }) => {
        templates.delete(where.key);
      },
    },
    auditLog: { create: async ({ data }: { data: { action: string } }) => audits.push(data.action) },
    deviceToken: { findMany: async () => [] },
  };
  const firebase = { isConfigured: () => false };
  const svc = new NotificationsService(prisma as never, firebase as never);
  return { svc, created, audits, templates };
}

const vars = { jobTitle: 'Warehouse associate', company: 'Acme' };

describe('notification templates', () => {
  it('defaults render the same text the app sent before templates existed', () => {
    assert.deepEqual(renderDefaultNotification('APPLICATION_SHORTLISTED', vars), {
      title: 'You have been shortlisted',
      body: 'Acme shortlisted you for Warehouse associate. They may contact you to schedule an interview.',
    });
    assert.equal(
      renderDefaultNotification('APPLICATION_REJECTED', { ...vars, feedback: ' Feedback: Needs forklift licence' }).body,
      'Acme will not be moving forward with your application for Warehouse associate. Feedback: Needs forklift licence',
    );
  });

  it('an active admin override changes the delivered notification; reset restores the default', async () => {
    const { svc, created, audits } = harness();
    const send = () =>
      svc.create({
        userId: 'u1',
        ...renderDefaultNotification('APPLICATION_SHORTLISTED', vars),
        templateKey: 'APPLICATION_SHORTLISTED',
        templateVars: vars,
      });

    await send();
    assert.equal(created[0].title, 'You have been shortlisted');

    await svc.updateTemplate('admin1', 'APPLICATION_SHORTLISTED', {
      title: 'Great news from {{company}}',
      body: 'You are shortlisted for {{jobTitle}}.',
    });
    await send();
    assert.deepEqual(created[1], { title: 'Great news from Acme', body: 'You are shortlisted for Warehouse associate.' });

    await svc.updateTemplate('admin1', 'APPLICATION_SHORTLISTED', {
      title: 'Great news from {{company}}',
      body: 'You are shortlisted for {{jobTitle}}.',
      active: false,
    });
    await send();
    assert.equal(created[2].title, 'You have been shortlisted', 'inactive override falls back to default');

    const reset = await svc.resetTemplate('admin1', 'APPLICATION_SHORTLISTED');
    assert.equal(reset.customized, false);
    assert.deepEqual(audits, ['NOTIFICATION_TEMPLATE_UPDATED', 'NOTIFICATION_TEMPLATE_UPDATED', 'NOTIFICATION_TEMPLATE_RESET']);
  });

  it('rejects unknown keys and placeholders that the template does not provide', async () => {
    const { svc } = harness();
    await assert.rejects(svc.updateTemplate('a', 'NOPE', { title: 'Hello', body: 'World hello' }), NotFoundException);
    await assert.rejects(
      svc.updateTemplate('a', 'JOB_APPROVED', { title: 'Approved', body: 'Hi {{candidateName}}, done.' }),
      (err) => err instanceof BadRequestException && /Unknown placeholder/.test(String((err.getResponse() as { message: string }).message)),
    );
  });

  it('lists every template with default and current text', async () => {
    const { svc } = harness();
    const list = await svc.listTemplates();
    const invite = list.find((item) => item.key === 'JOB_INVITE')!;
    assert.equal(invite.customized, false);
    assert.deepEqual(invite.variables, ['company', 'jobTitle']);
    assert.ok(list.length >= 13);
  });
});
