'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { EmployerPortal } from '@/components/EmployerPortal';
import { Button } from '@/components/ui/Button';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InAppNotification,
} from '@/lib/api';
import { getStoredUser, isEmployerRole } from '@/lib/session';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function NotificationsList({
  items,
  loading,
  homeHref,
  onOpen,
  onMarkAll,
}: {
  items: InAppNotification[];
  loading: boolean;
  homeHref: string;
  onOpen: (item: InAppNotification) => void;
  onMarkAll: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">Applications, interviews, and account updates.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void onMarkAll()}>
          Mark all read
        </Button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No notifications yet.
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void onOpen(item)}
            className={`w-full rounded-2xl border p-4 text-left shadow-sm transition ${
              item.read ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {formatWhen(item.createdAt)}
                </p>
              </div>
              {!item.read ? (
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#dc2626]" />
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <Link href={homeHref} className="inline-block text-sm font-bold text-[#0a2e2c] hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEmployer, setIsEmployer] = useState(false);

  async function reload() {
    const result = await listNotifications();
    setItems(result.items || []);
  }

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.replace('/login');
      return;
    }
    setIsEmployer(isEmployerRole(user.role));
    reload()
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function onOpen(item: InAppNotification) {
    if (!item.read) {
      await markNotificationRead(item.id).catch(() => undefined);
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)));
    }
    if (item.link) router.push(item.link);
  }

  async function onMarkAll() {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((row) => ({ ...row, read: true })));
  }

  const list = (
    <NotificationsList
      items={items}
      loading={loading}
      homeHref={isEmployer ? '/employer' : '/dashboard'}
      onOpen={onOpen}
      onMarkAll={onMarkAll}
    />
  );

  if (isEmployer) {
    return <EmployerPortal>{list}</EmployerPortal>;
  }

  return (
    <CandidateAppShell activeTab="home" maxWidth="max-w-3xl">
      {list}
    </CandidateAppShell>
  );
}
