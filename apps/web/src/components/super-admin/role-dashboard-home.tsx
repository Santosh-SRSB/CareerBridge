'use client';

import Link from 'next/link';
import type { AdminDashboard } from '@careerbridge/shared';
import { canOpenAdminTab, type SuperAdminNavId } from '@/lib/admin-portal';

type Tile = {
  label: string;
  href: string;
  color: string;
  icon: string;
};

const MODULE_TILES: Tile[] = [
  { label: 'Candidates', href: '/srsbaadmin/dashboard?tab=candidates', color: '#27a9e3', icon: '👤' },
  { label: 'Employers', href: '/srsbaadmin/dashboard?tab=employers', color: '#28b779', icon: '🏢' },
  { label: 'Jobs', href: '/srsbaadmin/dashboard?tab=jobs', color: '#ffb848', icon: '📋' },
  { label: 'Applications', href: '/srsbaadmin/dashboard?tab=applications', color: '#da542e', icon: '📄' },
  { label: 'Interviews', href: '/srsbaadmin/dashboard?tab=interviews', color: '#2255a4', icon: '🎥' },
  { label: 'Skills', href: '/srsbaadmin/dashboard?tab=skills', color: '#f74d4d', icon: '✦' },
  { label: 'AI Usage', href: '/srsbaadmin/dashboard?tab=ai-usage', color: '#852b99', icon: '⚡' },
  { label: 'Notifications', href: '/srsbaadmin/dashboard?tab=notifications', color: '#0aa3c2', icon: '🔔' },
  { label: 'Reports', href: '/srsbaadmin/dashboard?tab=reports', color: '#1f9d68', icon: '📊' },
  { label: 'Audit', href: '/srsbaadmin/dashboard?tab=audit', color: '#c9a227', icon: '🧾' },
  { label: 'Administration', href: '/srsbaadmin/dashboard?tab=admins', color: '#2b3643', icon: '🛡' },
  { label: 'Settings', href: '/srsbaadmin/dashboard?tab=settings', color: '#5c6570', icon: '⚙' },
];

function visibleTiles(role: string | null) {
  return MODULE_TILES.filter((tile) => {
    const id = tile.href.includes('tab=')
      ? (tile.href.split('tab=')[1] as SuperAdminNavId)
      : 'dashboard';
    return canOpenAdminTab(role, id);
  });
}

function alertItems(metrics: AdminDashboard) {
  return [
    {
      label: 'Failed notifications',
      value: metrics.alerts?.failedNotifications ?? 0,
      href: '/srsbaadmin/dashboard?tab=notifications',
    },
    {
      label: 'Failed AI',
      value: metrics.alerts?.failedAiRequests ?? 0,
      href: '/srsbaadmin/dashboard?tab=ai-usage',
    },
    {
      label: 'Suspended',
      value: metrics.alerts?.suspendedAccounts ?? 0,
      href: '/srsbaadmin/dashboard?tab=candidates',
    },
    {
      label: 'Jobs attention',
      value: metrics.alerts?.jobsRequiringAttention ?? 0,
      href: '/srsbaadmin/dashboard?tab=jobs',
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
            className="sa-tile flex min-h-[88px] flex-col items-center justify-center gap-2 px-2 text-center text-white"
            style={{ ['--matrix-c1' as string]: tile.color, backgroundColor: tile.color }}
          >
            <span className="text-2xl" aria-hidden>
              {tile.icon}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide">{tile.label}</span>
          </Link>
        ))}
      </div>

      <section className="border border-[#d4af37]/40 bg-[#1a222c] text-white">
        <div className="border-b border-[#d4af37]/25 px-4 py-3">
          <h2 className="text-base font-semibold text-[#f0e6c8]">Command overview</h2>
          <p className="text-xs text-white/55">Full-platform visibility</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[#d4af37]/20 sm:grid-cols-4 xl:grid-cols-8">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-[#232b36] px-3 py-4 text-center">
              <p className="text-xl font-bold text-[#f0e6c8]">{value}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/55">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {metrics.funnel ? (
        <section className="border border-[#d4af37]/30 bg-white">
          <div className="border-b border-[#eee] bg-[#faf8f2] px-4 py-3">
            <h2 className="text-base font-semibold text-[#1a222c]">Recruitment funnel</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-5">
            {[
              ['Candidates', metrics.funnel.candidates],
              ['Applications', metrics.funnel.applications],
              ['Shortlisted', metrics.funnel.shortlisted],
              ['Interviews', metrics.funnel.interviews],
              ['Hires', metrics.funnel.hires],
            ].map(([label, value]) => (
              <div key={String(label)} className="border-l-4 border-[#c9a227] bg-[#faf8f2] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888]">{label}</p>
                <p className="mt-2 text-2xl font-bold text-[#1a222c]">{value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-[#ddd] bg-white">
          <div className="border-b border-[#eee] px-4 py-3">
            <h2 className="text-base font-semibold text-[#555]">Activity · 7 days</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 md:grid-cols-3">
            {[
              ['Candidate signups', metrics.activity?.candidateRegistrations7d ?? 0],
              ['Employer signups', metrics.activity?.employerRegistrations7d ?? 0],
              ['Jobs published', metrics.activity?.jobsPublished7d ?? 0],
              ['Applications', metrics.activity?.applications7d ?? 0],
              ['Interviews', metrics.activity?.interviews7d ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="border border-[#eee] bg-[#faf8f2] p-3">
                <p className="text-[10px] uppercase tracking-wide text-[#999]">{label}</p>
                <p className="mt-1 text-xl font-bold text-[#1a222c]">{value}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="border border-[#ddd] bg-white">
          <div className="border-b border-[#eee] px-4 py-3">
            <h2 className="text-base font-semibold text-[#555]">Operational alerts</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4">
            {alertItems(metrics).map((item) => (
              <Link key={item.label} href={item.href} className="bg-[#3d4957] px-3 py-4 text-center text-white">
                <p className="text-xl font-bold">{item.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-white/70">{item.label}</p>
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
          <div key={kpi.label} className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
            <div className="mb-3 h-1.5 w-10 rounded-full bg-teal-600" />
            <p className="text-3xl font-bold tracking-tight text-[#0f3d4c]">{kpi.value}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-teal-700/70">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-teal-800">Modules</h2>
          <p className="mb-3 text-xs text-slate-500">Day-to-day platform work</p>
          <div className="space-y-2">
            {tiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#f4fbfa] px-3 py-3 transition hover:border-teal-300 hover:bg-white"
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-lg text-white"
                  style={{ backgroundColor: tile.color }}
                  aria-hidden
                >
                  {tile.icon}
                </span>
                <span className="flex-1 text-sm font-semibold text-[#0f3d4c]">{tile.label}</span>
                <span className="text-xs font-bold text-teal-700">Open →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-teal-800">Pipeline</h2>
          <p className="mb-4 text-xs text-slate-500">Recruitment funnel</p>
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
                  <span className="font-semibold text-slate-600">{label}</span>
                  <span className="font-bold text-teal-800">{value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-teal-100">
                  <div className="admin-bar h-full rounded-full" style={{ width: `${Math.max(8, width)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-[0.14em] text-teal-800">Alerts</h2>
          <div className="grid grid-cols-2 gap-2">
            {alertItems(metrics).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-3"
              >
                <p className="text-2xl font-bold text-rose-700">{item.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-800/70">{item.label}</p>
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
            className="inline-flex items-center gap-2 border border-cyan-700 bg-[#0c2744] px-3 py-2 text-white"
          >
            <span aria-hidden>{tile.icon}</span>
            <span className="text-xs font-bold uppercase tracking-wide">{tile.label}</span>
          </Link>
        ))}
      </div>

      <section className="overflow-hidden border border-[#0c2744] bg-[#0c2744] text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-cyan-200">Live ops board</h2>
            <p className="text-xs text-white/50">Queue visibility</p>
          </div>
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
          </span>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
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
            <div key={cell.label} className="bg-[#0f3052] px-4 py-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{cell.label}</p>
              <p className="mt-2 text-3xl font-black tabular-nums text-cyan-300">{cell.value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#0c2744]">Funnel steps</h2>
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
                  <span className="text-sm font-bold text-[#0c2744]">{value}</span>
                  <div className="w-full bg-cyan-700" style={{ height: h }} />
                  <span className="text-[10px] font-bold uppercase text-slate-500">{label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border border-amber-200 bg-[#fffbeb] p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-amber-900">Ops alerts</h2>
          <div className="space-y-2">
            {alertItems(metrics).map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between border border-amber-100 bg-white px-3 py-2.5"
              >
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
                <span className="bg-amber-500 px-2 py-0.5 text-sm font-black text-white">{item.value}</span>
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
