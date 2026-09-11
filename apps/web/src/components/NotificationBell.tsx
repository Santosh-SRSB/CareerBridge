'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listNotifications } from '@/lib/api';
import { getAccessToken } from '@/lib/session';

type Props = {
  href?: string;
  className?: string;
  /** Employer deskbar uses ep-deskbar__bell styling */
  variant?: 'candidate' | 'candidate-pill' | 'employer';
  pollMs?: number;
};

export function NotificationBell({
  href = '/notifications',
  className = '',
  variant = 'candidate',
  pollMs = 30000,
}: Props) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      if (!getAccessToken()) {
        if (active) setUnreadCount(0);
        return;
      }
      try {
        const result = await listNotifications();
        if (active) setUnreadCount(result.unreadCount || 0);
      } catch {
        if (active) setUnreadCount(0);
      }
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), pollMs);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [pollMs]);

  const label =
    unreadCount > 0
      ? `Notifications, ${unreadCount} unread`
      : 'Notifications';
  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount);
  const hasUnread = unreadCount > 0;

  if (variant === 'employer') {
    return (
      <Link
        href={href}
        className={`ep-deskbar__bell${hasUnread ? ' has-unread' : ''} ${className}`.trim()}
        aria-label={label}
      >
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 4.5a4.5 4.5 0 0 0-4.5 4.5v3.2l-1.4 2.3a1 1 0 0 0 .9 1.5h10a1 1 0 0 0 .9-1.5l-1.4-2.3V9A4.5 4.5 0 0 0 12 4.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        {hasUnread ? (
          <span className="ep-deskbar__bell-badge" aria-hidden>
            {badgeText}
          </span>
        ) : null}
      </Link>
    );
  }

  if (variant === 'candidate-pill') {
    return (
      <Link
        href={href}
        className={`relative flex h-12 w-12 items-center justify-center rounded-full border border-white/45 text-white transition hover:bg-white/10 ${className}`.trim()}
        aria-label={label}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
          />
        </svg>
        <span
            className={`absolute right-0.5 top-0.5 rounded-full bg-[#f0803c] ring-2 ring-[#0a2e2c] ${
            hasUnread
              ? 'flex h-3.5 min-w-3.5 items-center justify-center px-0.5 text-[8px] font-bold leading-none text-white'
              : 'h-2.5 w-2.5'
          }`}
          aria-hidden
        >
          {hasUnread ? badgeText : null}
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 ${className}`.trim()}
      aria-label={label}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
        />
      </svg>
      {hasUnread ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#dc2626] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
          {badgeText}
        </span>
      ) : null}
    </Link>
  );
}
