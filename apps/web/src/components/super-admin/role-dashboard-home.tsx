'use client';

import Link from 'next/link';
import type { AdminDashboard } from '@careerbridge/shared';
import { canOpenAdminTab, type SuperAdminNavId } from '@/lib/admin-portal';
import { AdminNavIcon } from '@/components/super-admin/admin-icons';

type Tile = {
  id: SuperAdminNavId;
  label: string;
  href: string;
};

const MODULE_TILES: Tile[] = [
  { id: 'candidates', label: 'Candidates', href: '/adminsrsb/dashboard?tab=candidates' },
  { id: 'employers', label: 'Employers', href: '/adminsrsb/dashboard?tab=employers' },
  { id: 'jobs', label: 'Jobs', href: '/adminsrsb/dashboard?tab=jobs' },
  { id: 'applications', label: 'Applications', href: '/adminsrsb/dashboard?tab=applications' },
  { id: 'interviews', label: 'Interviews', href: '/adminsrsb/dashboard?tab=interviews' },
  { id: 'skills', label: 'Skills', href: '/adminsrsb/dashboard?tab=skills' },
  { id: 'ai-usage', label: 'AI Usage', href: '/adminsrsb/dashboard?tab=ai-usage' },
  { id: 'notifications', label: 'Notifications', href: '/adminsrsb/dashboard?tab=notifications' },
  { id: 'testimonials', label: 'Testimonials', href: '/adminsrsb/dashboard?tab=testimonials' },
  { id: 'reports', label: 'Reports', href: '/adminsrsb/dashboard?tab=reports' },
  { id: 'audit', label: 'Audit', href: '/adminsrsb/dashboard?tab=audit' },
  { id: 'admins', label: 'Administration', href: '/adminsrsb/dashboard?tab=admins' },
  { id: 'settings', label: 'Settings', href: '/adminsrsb/dashboard?tab=settings' },
];

function visibleTiles(role: string | null) {
  return MODULE_TILES.filter((tile) => canOpenAdminTab(role, tile.id));
}

function aiBudgetLabel(status: 'OK' | 'WARNING' | 'LIMIT_REACHED' | 'DISABLED') {
  if (status === 'LIMIT_REACHED') return 'AI daily limit reached';
  if (status === 'DISABLED') return 'AI turned off';
  return 'AI usage above 80% today';
}

function alertItems(metrics: AdminDashboard) {
  return [
    {
      label: 'Failed notifications',
      value: metrics.alerts?.failedNotifications ?? 0,
      href: '/adminsrsb/dashboard?tab=notifications',
    },
    {
      label: 'Failed AI',
      value: metrics.alerts?.failedAiRequests ?? 0,
      href: '/adminsrsb/dashboard?tab=ai-usage',
    },
    ...(metrics.alerts?.aiBudget && metrics.alerts.aiBudget.status !== 'OK'
      ? [
          {
            label: aiBudgetLabel(metrics.alerts.aiBudget.status),
            value: metrics.alerts.aiBudget.requestsToday,
            href: '/adminsrsb/dashboard?tab=ai-usage',
          },
        ]
      : []),
    {
      label: 'Suspended',
      value: metrics.alerts?.suspendedAccounts ?? 0,
      href: '/adminsrsb/dashboard?tab=candidates',
    },
    {
      label: 'Jobs attention',
      value: metrics.alerts?.jobsRequiringAttention ?? 0,
      href: '/adminsrsb/dashboard?tab=jobs',
    },
  ];
}

/** SUPER_ADMIN — dense colorful module grid + dark gold command board */
function SuperCommandHome({ metrics, role }: { metrics: AdminDashboard; role: string | null }) {
  const tiles = visibleTiles(role);
  const stats = [
    ['Candidates', metrics.candidates],
    ['Active', metrics.activeCandidates],
    ['Employers', metrics.employers],
    ['Jobs', metrics.openJobs],
    ['Applications', metrics.applications],
    ['Interviews', metrics.interviews],
    ['Hires', metrics.hires ?? 0],
    ['AI', metrics.aiUsage?.totalRequests ?? 0],
  ] as Array<[string, number]>;

  return (
    <div className="role-home role-home--super space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="sa-tile flex min-h-[88px] flex-col items-center justify-center gap-2 px-2 text-center"
          >
            <AdminNavIcon id={tile.id} size={22} />
            <span className="text-[11px]">{tile.label}</span>
          </Link>
        ))}
      </div>

      <section className="sa-overview">
        <div className="px-4 py-3">
          <h2 className="text-base font-bold">Command overview</h2>
          <p className="sa-on-dark-muted text-xs">Full-platform visibility</p>
        </div>
        <div className="sa-overview-grid grid grid-cols-2 gap-px sm:grid-cols-4 xl:grid-cols-8">
          {stats.map(([label, value]) => (
            <div key={label} className="px-3 py-4 text-center">
              <p className="text-xl font-extrabold">{value}</p>
              <p className="sa-on-dark-muted mt-1 text-[10px] font-bold uppercase tracking-[0.1em]">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {metrics.funnel ? (
        <section className="sa-card overflow-hidden">
          <div className="sa-card-h px-4 py-3">
            <h2 className="sa-h2 text-base">Recruitment funnel</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-5">
            {[
              ['Candidates', metrics.funnel.candidates],
              ['Applications', metrics.funnel.applications],
              ['Shortlisted', metrics.funnel.shortlisted],
              ['Interviews', metrics.funnel.interviews],
              ['Hires', metrics.funnel.hires],
            ].map(([label, value]) => (
              <div key={String(label)} className="sa-stat p-4">
                <p className="sa-label">{label}</p>
                <p className="sa-value mt-2 text-2xl">{value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="sa-card overflow-hidden">
          <div className="sa-card-h px-4 py-3">
            <h2 className="sa-h2 text-base">Activity · 7 days</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-3">
            {[
              ['Candidate signups', metrics.activity?.candidateRegistrations7d ?? 0],
              ['Employer signups', metrics.activity?.employerRegistrations7d ?? 0],
              ['Jobs published', metrics.activity?.jobsPublished7d ?? 0],
              ['Applications', metrics.activity?.applications7d ?? 0],
              ['Interviews', metrics.activity?.interviews7d ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="sa-stat sa-stat--peri min-w-0 p-3">
                <p className="sa-label">{label}</p>
                <p className="sa-value mt-1 text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="sa-card overflow-hidden">
          <div className="sa-card-h px-4 py-3">
            <h2 className="sa-h2 text-base">Operational alerts</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            {alertItems(metrics).map((item) => (
              <Link key={item.label} href={item.href} className="sa-alert min-w-0 px-3 py-4 text-center">
                <p className="text-xl font-extrabold">{item.value}</p>
                <p className="sa-on-dark-muted mt-1 text-[10px] font-bold uppercase tracking-[0.1em]">{item.label}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** PLATFORM_ADMIN — soft teal executive: KPIs first, then module list rows */
function AdminExecutiveHome({ metrics, role }: { metrics: AdminDashboard; role: string | null }) {
  const tiles = visibleTiles(role);
  const kpis = [
    { label: 'Candidates', value: metrics.candidates },
    { label: 'Active jobs', value: metrics.openJobs },
    { label: 'Applications', value: metrics.applications },
    { label: 'Interviews', value: metrics.interviews },
    { label: 'Hires', value: metrics.hires ?? 0 },
    { label: 'AI requests', value: metrics.aiUsage?.totalRequests ?? 0 },
  ];

  return (
    <div className="role-home role-home--admin space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="sa-kpi p-4 shadow-[var(--sa-shadow)]">
            <p className="sa-value text-3xl tracking-tight">{kpi.value}</p>
            <p className="sa-label mt-1 text-xs">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="sa-card p-4">
          <h2 className="sa-eyebrow text-sm">Modules</h2>
          <p className="sa-muted mb-3 text-xs">Day-to-day platform work</p>
          <div className="space-y-2">
            {tiles.map((tile) => (
              <Link key={tile.label} href={tile.href} className="sa-stat flex items-center gap-3 px-3 py-3">
                <span className="sa-icon-box flex h-10 w-10 shrink-0 items-center justify-center">
                  <AdminNavIcon id={tile.id} />
                </span>
                <span className="sa-ink flex-1 text-sm font-semibold">{tile.label}</span>
                <span className="sa-brand-text text-xs font-bold">Open →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="sa-card p-4">
          <h2 className="sa-eyebrow text-sm">Pipeline</h2>
          <p className="sa-muted mb-4 text-xs">Recruitment funnel</p>
          <div className="space-y-3">
            {(
              [
                ['Candidates', metrics.funnel?.candidates ?? metrics.candidates, 100],
                ['Applications', metrics.funnel?.applications ?? 0, 78],
                ['Shortlisted', metrics.funnel?.shortlisted ?? 0, 56],
                ['Interviews', metrics.funnel?.interviews ?? 0, 38],
                ['Hires', metrics.funnel?.hires ?? 0, 22],
              ] as Array<[string, number, number]>
            ).map(([label, value, width]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="sa-muted font-semibold">{label}</span>
                  <span className="sa-ink font-bold">{value}</span>
                </div>
                <div className="sa-meter h-2 overflow-hidden">
                  <span style={{ width: `${Math.max(8, width)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h2 className="sa-eyebrow mb-2 mt-6 text-sm">Alerts</h2>
          <div className="grid grid-cols-2 gap-2">
            {alertItems(metrics).map((item) => (
              <Link key={item.label} href={item.href} className="sa-alert min-w-0 px-3 py-3">
                <p className="text-2xl font-extrabold">{item.value}</p>
                <p className="sa-on-dark-muted text-[10px] font-bold uppercase tracking-[0.1em]">{item.label}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/** PLATFORM_OPERATOR — navy ops board + horizontal module chips + bar funnel */
function OpsFloorHome({ metrics, role }: { metrics: AdminDashboard; role: string | null }) {
  const tiles = visibleTiles(role);
  return (
    <div className="role-home role-home--ops space-y-4">
      <div className="flex flex-wrap gap-2">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="sa-chip inline-flex min-h-10 items-center gap-2 px-3.5 text-xs"
          >
            <AdminNavIcon id={tile.id} size={16} />
            <span>{tile.label}</span>
          </Link>
        ))}
      </div>

      <section className="sa-overview">
        <div className="flex items-center justify-between border-b border-[var(--sa-on-dark-line)] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em]">Live ops board</h2>
            <p className="sa-on-dark-muted text-xs">Queue visibility</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sa-lav)]" /> Live
          </span>
        </div>
        <div className="sa-overview-grid grid grid-cols-2 gap-px sm:grid-cols-4">
          {[
            { label: 'Candidates', value: metrics.candidates },
            { label: 'Active jobs', value: metrics.openJobs },
            { label: 'Applications', value: metrics.applications },
            { label: 'Interviews', value: metrics.interviews },
            { label: 'Hires', value: metrics.hires ?? 0 },
            { label: 'AI calls', value: metrics.aiUsage?.totalRequests ?? 0 },
            { label: 'Employers', value: metrics.employers },
            { label: 'Active people', value: metrics.activeCandidates },
          ].map((cell) => (
            <div key={cell.label} className="px-4 py-5">
              <p className="sa-on-dark-muted text-[10px] font-bold uppercase tracking-wider">{cell.label}</p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{cell.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="sa-card p-4">
          <h2 className="sa-eyebrow text-sm">Funnel steps</h2>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            {(
              [
                ['Cand', metrics.funnel?.candidates ?? metrics.candidates],
                ['Apps', metrics.funnel?.applications ?? 0],
                ['Short', metrics.funnel?.shortlisted ?? 0],
                ['Int', metrics.funnel?.interviews ?? 0],
                ['Hire', metrics.funnel?.hires ?? 0],
              ] as Array<[string, number]>
            ).map(([label, value], i) => {
              const h = 48 + Math.min(120, Number(value) * 18 + i * 8);
              return (
                <div key={label} className="flex min-w-[52px] flex-1 flex-col items-center gap-2">
                  <span className="sa-ink text-sm font-bold">{value}</span>
                  <div className="sa-bar w-full rounded-t-md" style={{ height: h }} />
                  <span className="sa-muted text-[10px] font-bold uppercase">{label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sa-card p-4">
          <h2 className="sa-eyebrow mb-3 text-sm">Ops alerts</h2>
          <div className="space-y-2">
            {alertItems(metrics).map((item) => (
              <Link key={item.label} href={item.href} className="sa-stat flex items-center justify-between gap-2 px-3 py-2.5">
                <span className="sa-ink text-sm font-semibold">{item.label}</span>
                <span className="sa-badge sa-badge--dark px-2 py-0.5 text-sm">{item.value}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function RoleDashboardHome({
  role,
  metrics,
}: {
  role: string | null;
  metrics: AdminDashboard;
}) {
  if (role === 'SUPER_ADMIN') return <SuperCommandHome metrics={metrics} role={role} />;
  if (role === 'PLATFORM_OPERATOR') return <OpsFloorHome metrics={metrics} role={role} />;
  return <AdminExecutiveHome metrics={metrics} role={role} />;
}

export function roleDashboardHero(role: string | null) {
  if (role === 'SUPER_ADMIN') {
    return {
      eyebrow: 'Command bridge',
      title: 'Super Admin',
      blurb: 'Full control · admins, settings, audit',
      className: 'role-hero role-hero--super',
    };
  }
  if (role === 'PLATFORM_OPERATOR') {
    return {
      eyebrow: 'Ops floor',
      title: 'Operations',
      blurb: 'Live queue · candidates, jobs, delivery',
      className: 'role-hero role-hero--ops',
    };
  }
  return {
    eyebrow: 'Admin console',
    title: 'Platform Admin',
    blurb: 'Day-to-day management · no settings lock',
    className: 'role-hero role-hero--admin',
  };
}
