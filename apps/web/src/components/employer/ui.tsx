'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { atsMatchBandInfo } from '@careerbridge/shared';
import { listNotifications } from '@/lib/api';
import { getAccessToken } from '@/lib/session';
import { jobStatusLabel } from '@/lib/job-status';
import {
  applicationStatusMeta,
  initials,
  interviewStatusMeta,
  jobStatusChip,
  matchBarTone,
  matchPillTone,
  pipelineStage,
  type EvTone,
} from '@/lib/employer-ui-status';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/** Gradient page header (reference `.phead`). */
export function EvPageHead({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="ev-phead">
      <div>
        {eyebrow ? <small>{eyebrow.toUpperCase()}</small> : null}
        <h1 className="ev-pg">{title}</h1>
        {subtitle ? <p className="ev-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ev-phead-actions">{actions}</div> : null}
      {children}
    </header>
  );
}

/** Plain page header (reference `.jh`, used by Jobs / Post a job). */
export function EvPlainHead({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ev-jh">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function EvStat({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
}) {
  const body = (
    <>
      <span>{label}</span>
      <b>{value}</b>
      {hint ? <em>{hint}</em> : null}
      {icon ? (
        <i className="ev-ic" aria-hidden>
          {icon}
        </i>
      ) : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="ev-card ev-stat">
        {body}
      </Link>
    );
  }
  return <div className="ev-card ev-stat">{body}</div>;
}

export function EvPill({ tone = 'default', children }: { tone?: EvTone; children: ReactNode }) {
  return <span className={cx('ev-pill', tone !== 'default' && `ev-pill--${tone}`)}>{children}</span>;
}

export function EvApplicationPill({ status }: { status?: string | null }) {
  const meta = applicationStatusMeta(status);
  return <EvPill tone={meta.tone}>{meta.label}</EvPill>;
}

export function EvInterviewPill({ status, label }: { status?: string | null; label?: string }) {
  const meta = interviewStatusMeta(status);
  return <EvPill tone={meta.tone}>{label || meta.label}</EvPill>;
}

export function EvJobStatus({ status }: { status?: string | null }) {
  const chip = jobStatusChip(status);
  return (
    <span className={cx('ev-st', chip && `ev-st--${chip}`)}>
      <i aria-hidden />
      {jobStatusLabel(String(status || 'DRAFT'))}
    </span>
  );
}

export function EvAvatar({ name, size = 'md' }: { name?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={cx('ev-av', size !== 'lg' && `ev-av--${size}`)} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Profile Match bar + handbook band pill (e.g. "25%  Low"). */
export function EvMatch({ score, showBand = true }: { score?: number | null; showBand?: boolean }) {
  if (score == null || !Number.isFinite(Number(score))) return <span className="ev-sub">—</span>;
  const value = Math.max(0, Math.min(100, Math.round(Number(score))));
  const info = atsMatchBandInfo(value);
  const tone = matchBarTone(info.band);
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span className={cx('ev-mbar', tone !== 'low' && `ev-mbar--${tone}`)} aria-hidden>
        <i style={{ width: `${value}%` }} />
      </span>
      <b>{value}%</b>
      {showBand ? (
        <>
          {' '}
          <EvPill tone={matchPillTone(info.color)}>{info.shortLabel}</EvPill>
        </>
      ) : null}
    </span>
  );
}

export function EvMiniStage({ status }: { status?: string | null }) {
  const stage = pipelineStage(status);
  return (
    <span className="ev-mini" aria-hidden>
      {[0, 1, 2, 3].map((step) => (
        <i key={step} className={stage >= step ? 'on' : undefined} />
      ))}
    </span>
  );
}

export function EvEmpty({ title, body, action }: { title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="ev-empty">
      <b>{title}</b>
      {body ? <p className="ev-sub">{body}</p> : null}
      {action}
    </div>
  );
}

export function EvStepHead({ n, title, hint }: { n: number | string; title: string; hint?: ReactNode }) {
  return (
    <div className="ev-stp">
      <span className="ev-num">{n}</span>
      <div>
        <h2>{title}</h2>
        {hint ? <small>{hint}</small> : null}
      </div>
    </div>
  );
}

export function EvSwitch({
  checked,
  onChange,
  disabled,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="ev-sw">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden />
      {children}
    </label>
  );
}

export function EvAlert({ tone = 'info', children }: { tone?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <div className={`ev-alert ev-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function EvSkeleton({ height = 120 }: { height?: number }) {
  return <div className="ev-skel" style={{ height }} aria-hidden />;
}

export function EvPageSkeleton() {
  return (
    <div className="ev-pad" aria-busy="true">
      <div className="ev-mt">
        <EvSkeleton height={140} />
      </div>
      <div className="ev-grid ev-g4 ev-mt">
        <EvSkeleton />
        <EvSkeleton />
        <EvSkeleton />
        <EvSkeleton />
      </div>
      <div className="ev-mt">
        <EvSkeleton height={260} />
      </div>
    </div>
  );
}

/** Unread in-app notifications for the employer sidebar; mirrors NotificationBell polling. */
export function useEmployerUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAccessToken()) return;
      try {
        const result = await listNotifications();
        if (!cancelled) setCount(result.unreadCount || 0);
      } catch {
        /* the badge is best-effort */
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return count;
}
