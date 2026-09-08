'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getWhatsAppIntegrationStatus,
  whatsappClearEvents,
  whatsappListEvents,
  whatsappSendInvitation,
  whatsappSendReminder,
  whatsappSendTest,
  whatsappSimulateWebhook,
  whatsappTestConnection,
} from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type EventRow = { id: string; at: string; kind: string; summary: string };

export default function WhatsAppIntegrationTestPage() {
  const router = useRouter();
  const [connection, setConnection] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [candidateName, setCandidateName] = useState('Rahul Kumar');
  const [to, setTo] = useState('');
  const [jobTitle, setJobTitle] = useState('Customer Service Executive');
  const [interviewDate, setInterviewDate] = useState('2026-08-25');
  const [interviewTime, setInterviewTime] = useState('11:00 AM');
  const [interviewId, setInterviewId] = useState('');
  const [lastInterviewId, setLastInterviewId] = useState('');
  const [simulateAction, setSimulateAction] = useState<'CONFIRM' | 'RESCHEDULE' | 'SLOT' | 'DECLINE'>(
    'CONFIRM',
  );
  const [reminderKind, setReminderKind] = useState<'24h' | '2h' | '15m'>('15m');
  const [testBody, setTestBody] = useState(
    'This is a test message from the Resume & Jobs platform.',
  );

  const refresh = useCallback(async () => {
    try {
      const status = await getWhatsAppIntegrationStatus();
      setConnection(status.connection as unknown as Record<string, unknown>);
      setEvents(status.events || []);
    } catch {
      // WhatsApp admin APIs require PLATFORM_ADMIN / PLATFORM_OPERATOR token
      router.replace('/srsbaadmin?next=/admin/integrations/whatsapp/test');
    }
  }, [router]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void whatsappListEvents(40)
        .then((res) => setEvents(res.items || []))
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      const result = await fn();
      setMessage(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy('');
    }
  }

  async function onSendInvite(event: FormEvent) {
    event.preventDefault();
    await run('invite', async () => {
      const result = await whatsappSendInvitation({
        candidateName,
        to,
        jobTitle,
        interviewDate,
        interviewTime,
        interviewId: interviewId || undefined,
        durationMin: 20,
      });
      if (result.interviewId) {
        setLastInterviewId(result.interviewId);
        if (!interviewId) setInterviewId(result.interviewId);
      }
      return result;
    });
  }

  const checks = [
    ['Meta API Connected', Boolean(connection?.configured && connection?.accessToken)],
    ['Phone Number Configured', Boolean(connection?.phoneNumberId)],
    ['Verify Token Set', Boolean(connection?.verifyToken)],
    ['App Secret Set', Boolean(connection?.appSecret)],
  ] as const;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Integration Test Console
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">WhatsApp Integration Test</h1>
        </div>
        <Link href="/admin" className="text-sm font-semibold text-[#0a2e2c] hover:underline">
          ← Admin
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Integration Status</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {checks.map(([label, ok]) => (
            <li key={label} className="flex items-center gap-2">
              <span className={ok ? 'text-emerald-600' : 'text-amber-600'}>{ok ? '✓' : '○'}</span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Webhook: <code>{String(connection?.webhookPath || '')}</code>
          <br />
          Alias: <code>{String(connection?.webhookAliasPath || '')}</code>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            loading={busy === 'connection'}
            onClick={() => run('connection', () => whatsappTestConnection())}
          >
            Test WhatsApp Connection
          </Button>
          <Button type="button" variant="outline" onClick={() => refresh()}>
            Refresh status
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Test B — Send plain message</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="WhatsApp Number" value={to} onChange={(e) => setTo(e.target.value)} placeholder="+91XXXXXXXXXX" />
          <Input label="Message" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
        </div>
        <Button
          className="mt-3"
          type="button"
          loading={busy === 'send'}
          onClick={() => run('send', () => whatsappSendTest({ to, body: testBody }))}
        >
          Send Test Message
        </Button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Test C — Interview invitation</h2>
        <form onSubmit={onSendInvite} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input label="Candidate Name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
          <Input label="WhatsApp Number" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input label="Job Title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
          <Input label="Interview ID (optional)" value={interviewId} onChange={(e) => setInterviewId(e.target.value)} />
          <Input label="Interview Date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} placeholder="YYYY-MM-DD" />
          <Input label="Interview Time" value={interviewTime} onChange={(e) => setInterviewTime(e.target.value)} placeholder="11:00 AM" />
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy === 'invite'}>
              Send Interview Invitation
            </Button>
          </div>
        </form>
        {lastInterviewId ? (
          <p className="mt-2 text-xs text-slate-600">Last interview id: <code>{lastInterviewId}</code></p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Test F — Webhook simulator</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Action</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={simulateAction}
              onChange={(e) => setSimulateAction(e.target.value as typeof simulateAction)}
            >
              <option value="CONFIRM">CONFIRM</option>
              <option value="RESCHEDULE">RESCHEDULE</option>
              <option value="SLOT">SLOT</option>
              <option value="DECLINE">DECLINE</option>
            </select>
          </label>
          <Input
            label="Interview ID"
            value={interviewId || lastInterviewId}
            onChange={(e) => setInterviewId(e.target.value)}
          />
        </div>
        <Button
          className="mt-3"
          type="button"
          loading={busy === 'simulate'}
          onClick={() =>
            run('simulate', () =>
              whatsappSimulateWebhook({
                action: simulateAction,
                interviewId: interviewId || lastInterviewId,
              }),
            )
          }
        >
          Simulate Webhook
        </Button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Test G — Reminder now</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Input
            label="Interview ID"
            value={interviewId || lastInterviewId}
            onChange={(e) => setInterviewId(e.target.value)}
          />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Reminder</span>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={reminderKind}
              onChange={(e) => setReminderKind(e.target.value as typeof reminderKind)}
            >
              <option value="24h">24 hours</option>
              <option value="2h">2 hours</option>
              <option value="15m">15 minutes</option>
            </select>
          </label>
        </div>
        <Button
          className="mt-3"
          type="button"
          loading={busy === 'reminder'}
          onClick={() =>
            run('reminder', () =>
              whatsappSendReminder({
                interviewId: interviewId || lastInterviewId,
                kind: reminderKind,
              }),
            )
          }
        >
          Send Reminder Now
        </Button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900">Webhook Events</h2>
          <Button
            type="button"
            variant="outline"
            onClick={() => run('clear', () => whatsappClearEvents())}
          >
            Clear
          </Button>
        </div>
        <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-700">
          {events.length === 0 ? (
            <p>No events yet.</p>
          ) : (
            events.map((item) => (
              <div key={item.id} className="border-b border-slate-200 py-1.5 last:border-0">
                <span className="text-slate-400">{new Date(item.at).toLocaleTimeString()}</span>{' '}
                <span className="font-bold">{item.kind}</span> — {item.summary}
              </div>
            ))
          )}
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? (
        <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-emerald-200">{message}</pre>
      ) : null}
    </main>
  );
}
