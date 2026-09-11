'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AdminDashboard } from '@careerbridge/shared';
import {
  createAdminSkill,
  createPlatformAdmin,
  getAdminAudit,
  getAdminDashboard,
  getAdminList,
  getAdminNotifications,
  getAdminRecord,
  getAdminReports,
  getAdminSettings,
  setAdminCandidateStatus,
  setAdminEmployerStatus,
  setAdminJobStatus,
  setPlatformAdminRole,
  setPlatformAdminStatus,
  setPlatformAdminPassword,
  updateAdminSettings,
  updateAdminSkill,
  verifyEmployer,
  getAdminAiUsage,
} from '@/lib/api';
import { SuperAdminShell } from '@/components/super-admin/SuperAdminShell';
import {
  ActionBtn,
  DetailPanel,
  ModuleBanner,
  ModuleCanvas,
  SearchBar,
  StatusPill,
  TAB_THEME,
} from '@/components/super-admin/admin-tab-ui';
import {
  canManageAdmins,
  canManageJobs,
  canManageSkills,
  canOpenAdminTab,
  type SuperAdminNavId,
} from '@/lib/admin-portal';
import { getStoredUser, isPlatformRole, isSuperAdminRole } from '@/lib/session';
import { RoleDashboardHome, roleDashboardHero } from '@/components/super-admin/role-dashboard-home';

const TABS: SuperAdminNavId[] = [
  'dashboard',
  'candidates',
  'employers',
  'jobs',
  'applications',
  'interviews',
  'skills',
  'ai-usage',
  'notifications',
  'reports',
  'admins',
  'settings',
  'audit',
];

const LIST_TABS: SuperAdminNavId[] = [
  'candidates',
  'employers',
  'jobs',
  'applications',
  'interviews',
  'skills',
  'admins',
];

function isTab(value: string | null): value is SuperAdminNavId {
  return Boolean(value && (TABS as string[]).includes(value));
}

function cell(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/** Workflow doc Settings groups only — controlled config, not free-form DB keys. */
const SETTINGS_SCHEMA: Array<{
  group: string;
  title: string;
  fields: Array<{ key: string; label: string; hint?: string; kind?: 'toggle' | 'text' }>;
}> = [
  {
    group: 'platform',
    title: 'Platform',
    fields: [{ key: 'platform.maintenanceMode', label: 'Maintenance mode', kind: 'toggle' }],
  },
  {
    group: 'resume',
    title: 'Resume',
    fields: [
      { key: 'resume.atsEnabled', label: 'ATS scoring enabled', kind: 'toggle' },
      { key: 'resume.maxVersions', label: 'Max resume versions', kind: 'text' },
    ],
  },
  {
    group: 'ats',
    title: 'ATS',
    fields: [
      { key: 'ats.scoreThreshold', label: 'Score thresholds', kind: 'text' },
      { key: 'ats.scoreVersion', label: 'Score calculation version', kind: 'text' },
      { key: 'ats.matchingEnabled', label: 'Matching configuration', kind: 'toggle' },
    ],
  },
  {
    group: 'ai',
    title: 'AI',
    fields: [
      { key: 'ai.enabled', label: 'Feature enable / disable', kind: 'toggle' },
      { key: 'ai.dailyRequestLimit', label: 'Usage limits (daily requests)', kind: 'text' },
      { key: 'ai.tokenLimit', label: 'Token limits', kind: 'text' },
    ],
  },
  {
    group: 'notifications',
    title: 'Notifications',
    fields: [
      { key: 'notifications.enabled', label: 'Notification enable / disable', kind: 'toggle' },
      { key: 'notifications.remindersEnabled', label: 'Reminder configuration', kind: 'toggle' },
      { key: 'notifications.templatesEnabled', label: 'Notification templates', kind: 'toggle' },
    ],
  },
  {
    group: 'system',
    title: 'System',
    fields: [{ key: 'system.auditRetentionDays', label: 'Audit retention (days)', kind: 'text' }],
  },
];

const SETTINGS_KEYS = SETTINGS_SCHEMA.flatMap((g) => g.fields.map((f) => f.key));

function asRows(data: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object');
}

export default function SuperAdminDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: SuperAdminNavId = isTab(tabParam) ? tabParam : 'dashboard';

  const [ready, setReady] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [metrics, setMetrics] = useState<AdminDashboard | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<{
    summary: Record<string, number>;
    inbox: Array<Record<string, unknown>>;
    whatsapp: Array<Record<string, unknown>>;
  } | null>(null);
  const [reports, setReports] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [auditRows, setAuditRows] = useState<Array<Record<string, unknown>>>([]);

  const [skillName, setSkillName] = useState('');
  const [skillCategory, setSkillCategory] = useState('');
  const [skillAliases, setSkillAliases] = useState('');

  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminRole, setAdminRole] = useState<'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR'>(
    'PLATFORM_OPERATOR',
  );

  useEffect(() => {
    const user = getStoredUser();
    if (!user || !isPlatformRole(user.role)) {
      router.replace('/srsbaadmin');
      return;
    }
    setSuperAdmin(isSuperAdminRole(user.role));
    setStaffRole(user.role);
    setReady(true);
    getAdminDashboard()
      .then(setMetrics)
      .catch(() => {
        setError('Could not load dashboard metrics.');
        router.replace('/srsbaadmin');
      });
  }, [router]);

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
    setError('');
    setOk('');
    setDetail(null);
    setStatusFilter('');
  }, [tab]);

  useEffect(() => {
    if (!ready) return;
    if (!canOpenAdminTab(staffRole, tab)) {
      router.replace('/srsbaadmin/dashboard');
    }
  }, [ready, tab, staffRole, router]);

  async function reloadList(nextQuery = appliedSearch) {
    if (!LIST_TABS.includes(tab)) return;
    setListLoading(true);
    setError('');
    try {
      const q = nextQuery.trim();
      const params = new URLSearchParams();
      if (q) params.set('query', q);
      if (statusFilter && (tab === 'jobs' || tab === 'applications' || tab === 'interviews')) {
        params.set('status', statusFilter);
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await getAdminList(`${tab}${suffix}`);
      let next = asRows(data);
      if (statusFilter && (tab === 'candidates' || tab === 'employers' || tab === 'admins')) {
        next = next.filter((row) => String(row.accountStatus ?? row.status ?? '') === statusFilter);
      }
      setRows(next);
    } catch {
      setRows([]);
      setError(`Could not load ${tab}.`);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (!ready) return;

    if (LIST_TABS.includes(tab)) {
      void reloadList(appliedSearch);
      return;
    }

    if (tab === 'ai-usage') {
      setListLoading(true);
      getAdminAiUsage()
        .then((aiUsage) => setMetrics((prev) => (prev ? { ...prev, aiUsage } : prev)))
        .catch(() => setError('Could not load AI usage.'))
        .finally(() => setListLoading(false));
      return;
    }

    if (tab === 'notifications') {
      setListLoading(true);
      getAdminNotifications()
        .then(setNotifications)
        .catch(() => {
          setNotifications(null);
          setError('Could not load notifications.');
        })
        .finally(() => setListLoading(false));
      return;
    }

    if (tab === 'reports') {
      setListLoading(true);
      getAdminReports()
        .then(setReports)
        .catch(() => {
          setReports(null);
          setError('Could not load reports.');
        })
        .finally(() => setListLoading(false));
      return;
    }

    if (tab === 'settings' && superAdmin) {
      setListLoading(true);
      getAdminSettings()
        .then((data) => {
          const next: Record<string, string> = {};
          for (const key of SETTINGS_KEYS) next[key] = String(data[key] ?? '');
          setSettings(next);
        })
        .catch(() => {
          setSettings({});
          setError('Could not load settings.');
        })
        .finally(() => setListLoading(false));
      return;
    }

    if (tab === 'audit') {
      setListLoading(true);
      getAdminAudit(appliedSearch || undefined)
        .then((data) => setAuditRows(asRows(data)))
        .catch(() => {
          setAuditRows([]);
          setError('Could not load audit log.');
        })
        .finally(() => setListLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, tab, appliedSearch, superAdmin, statusFilter]);

  const reportBlocks = useMemo(() => {
    if (!reports) return [] as Array<{ title: string; entries: Array<[string, unknown]> }>;
    return Object.entries(reports).map(([title, value]) => ({
      title,
      entries:
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.entries(value as Record<string, unknown>)
          : [['value', value]],
    }));
  }, [reports]);

  async function runAction(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setError('');
    setOk('');
    try {
      await action();
      setOk(success);
      if (LIST_TABS.includes(tab)) await reloadList(appliedSearch);
      if (tab === 'dashboard') {
        const next = await getAdminDashboard();
        setMetrics(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function onCreateSkill(e: FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await createAdminSkill({
        name: skillName.trim(),
        category: skillCategory.trim(),
        aliases: skillAliases.trim() || undefined,
      });
      setSkillName('');
      setSkillCategory('');
      setSkillAliases('');
      setOk('Skill saved.');
      await reloadList(appliedSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create skill.');
    }
  }

  async function onCreateAdmin(e: FormEvent) {
    e.preventDefault();
    if (!superAdmin) return;
    setError('');
    setOk('');
    const createdPassword = adminPassword;
    const createdEmail = adminEmail.trim();
    const createdRole = adminRole;
    try {
      const created = await createPlatformAdmin({
        email: createdEmail,
        fullName: adminName.trim(),
        password: createdPassword,
        phone: adminPhone.trim() || undefined,
        role: createdRole,
      });
      setAdminEmail('');
      setAdminName('');
      setAdminPassword('');
      setAdminPhone('');
      setAdminRole('PLATFORM_OPERATOR');
      setOk(
        `Created ${created.userType || createdRole}: ${created.email || createdEmail} — password: ${created.password || createdPassword}`,
      );
      await reloadList(appliedSearch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create admin.');
    }
  }

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!superAdmin) return;
    setError('');
    setOk('');
    try {
      const payload: Record<string, string> = {};
      for (const key of SETTINGS_KEYS) payload[key] = settings[key] ?? '';
      const next = await updateAdminSettings(payload);
      const cleaned: Record<string, string> = {};
      for (const key of SETTINGS_KEYS) cleaned[key] = String(next[key] ?? '');
      setSettings(cleaned);
      setOk('Settings updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update settings.');
    }
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setAppliedSearch(search.trim());
  }

  async function openDetail(kind: 'candidates' | 'employers' | 'jobs' | 'applications' | 'interviews', id: string) {
    setError('');
    setOk('');
    try {
      const row = await getAdminRecord(`${kind}/${id}`);
      setDetail({ kind, ...row });
      // Scroll detail into view after paint.
      requestAnimationFrame(() => {
        document.getElementById('admin-record-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load details.');
    }
  }

  if (!ready) {
    return <main className="min-h-screen bg-[#eeeeee] p-8 text-sm text-[#888]">Checking access…</main>;
  }

  const theme = TAB_THEME[tab];

  return (
    <SuperAdminShell active={tab}>
      <div className="space-y-4">
        {tab === 'dashboard' ? (
          (() => {
            const hero = roleDashboardHero(staffRole);
            return (
              <div
                className={`${hero.className} mb-1 flex flex-wrap items-end justify-between gap-2 border-l-4 px-4 py-3`}
              >
                <div className="relative z-[1]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">{hero.eyebrow}</p>
                  <h1 className="text-2xl font-semibold text-[#222]">{hero.title}</h1>
                  <p className="text-xs opacity-80">{hero.blurb}</p>
                </div>
                <p className="relative z-[1] text-xs opacity-60">
                  Home <span className="mx-1">›</span> Dashboard
                </p>
              </div>
            );
          })()
        ) : (
          <ModuleBanner tab={tab} />
        )}

        {(error || ok) && (
          <div
            className={`px-4 py-3 text-sm font-semibold ${
              error ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-teal-200 bg-teal-50 text-teal-900'
            }`}
          >
            {error || ok}
          </div>
        )}

        {detail && (
          <div id="admin-record-detail">
            <DetailPanel
              title={`${theme.title} details`}
              data={detail}
              accent={theme.accent}
              onClose={() => setDetail(null)}
            />
          </div>
        )}

        <ModuleCanvas tab={tab}>
        {tab === 'dashboard' && (
          <div className="space-y-4">
            {!metrics ? (
              <p className="text-sm text-[#888]">Loading metrics…</p>
            ) : (
              <>
                <RoleDashboardHome role={staffRole} metrics={metrics} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="border border-[#e5e5e5] bg-white p-4">
                    <h2 className="mb-3 text-base font-semibold text-[#555]">Recent activity</h2>
                    <ul className="space-y-2 text-sm">
                      {(metrics.recentActivity ?? []).map((item) => (
                        <li key={`${item.at}-${item.label}`} className="flex gap-3 border-b border-[#f0f0f0] py-2 text-[#555]">
                          <span className="w-14 shrink-0 font-mono text-xs text-[#999]">{item.at.slice(11, 16)}</span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                      {(metrics.recentActivity ?? []).length === 0 && (
                        <li className="text-[#999]">No recent platform activity.</li>
                      )}
                    </ul>
                  </section>
                  <section className="border border-[#e5e5e5] bg-white p-4">
                    <h2 className="mb-3 text-base font-semibold text-[#555]">System status</h2>
                    <ul className="space-y-2 text-sm">
                      {(metrics.systemStatus ?? []).map((item) => (
                        <li key={item.name} className="flex items-center justify-between border-b border-[#f0f0f0] py-2">
                          <span>{item.name}</span>
                          <span
                            className={
                              item.status === 'Healthy' ? 'font-semibold text-[#28b779]' : 'font-semibold text-[#ffb848]'
                            }
                          >
                            ● {item.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'ai-usage' && (
          <div className="space-y-4">
            {!metrics ? (
              <p className="text-sm text-[#888]">Loading AI usage…</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Total requests', value: metrics.aiUsage?.totalRequests ?? 0, tone: '#f74d4d' },
                    { label: 'Failed', value: metrics.aiUsage?.failedRequests ?? 0, tone: '#da542e' },
                    {
                      label: 'Estimated cost',
                      value: `₹${Number(metrics.aiUsage?.estimatedCostInr ?? 0).toLocaleString('en-IN')}`,
                      tone: '#852b99',
                    },
                    {
                      label: 'Tokens',
                      value: Number(metrics.aiUsage?.totalTokens ?? 0).toLocaleString('en-IN'),
                      tone: '#2255a4',
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="relative overflow-hidden bg-white p-5 shadow-sm"
                      style={{ borderTop: `4px solid ${card.tone}` }}
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#888]">{card.label}</p>
                      <p className="mt-2 text-3xl font-black text-[#444]">{card.value}</p>
                      <div
                        className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-10"
                        style={{ background: card.tone }}
                      />
                    </div>
                  ))}
                </div>
                <div className="bg-[#2b3643] p-4 text-white">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/80">Usage by feature</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(metrics.aiUsage?.byFeature ?? []).map((row) => (
                      <div key={row.feature} className="flex items-center justify-between bg-white/10 px-3 py-3">
                        <div>
                          <span className="text-sm font-semibold">{row.feature}</span>
                          <p className="text-[11px] text-white/60">
                            {row.tokens ?? 0} tokens · ₹{Number(row.estimatedCostInr ?? 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="rounded bg-[#f74d4d] px-2 py-0.5 text-xs font-bold">{row.requests}</span>
                      </div>
                    ))}
                    {(metrics.aiUsage?.byFeature ?? []).length === 0 && (
                      <p className="text-sm text-white/60">No AI usage recorded yet.</p>
                    )}
                  </div>
                </div>
                {(metrics.aiUsage?.byUser?.length ?? 0) > 0 && (
                  <div className="overflow-hidden border border-[#f3c7c7] bg-white">
                    <div className="bg-[#852b99] px-4 py-2 text-sm font-bold text-white">Usage by user</div>
                    <ul className="divide-y divide-[#f3e8f8]">
                      {metrics.aiUsage!.byUser!.map((row) => (
                        <li key={String(row.userId ?? row.email)} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-[#444]">{row.email}</p>
                            <p className="text-xs text-[#888]">
                              {row.userType || '—'} · {row.tokens} tokens · ₹{row.estimatedCostInr}
                            </p>
                          </div>
                          <span className="rounded bg-[#852b99] px-2 py-0.5 text-xs font-bold text-white">
                            {row.requests}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(metrics.aiUsage?.recent?.length ?? 0) > 0 && (
                  <div className="overflow-hidden border border-[#f3c7c7] bg-white">
                    <div className="bg-[#f74d4d] px-4 py-2 text-sm font-bold text-white">Recent AI calls</div>
                    <ul className="divide-y divide-[#f8e8e8]">
                      {metrics.aiUsage!.recent!.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold text-[#444]">
                              {row.feature} · {row.provider}/{row.model}
                            </p>
                            <p className="text-xs text-[#888]">
                              {cell(row.at)} · {row.tokens} tokens · {row.latencyMs}ms
                              {row.error
                                ? ` · ${(() => {
                                    try {
                                      const parsed = JSON.parse(String(row.error)) as {
                                        error?: { message?: string };
                                        message?: string;
                                      };
                                      return parsed.error?.message || parsed.message || String(row.error);
                                    } catch {
                                      return String(row.error);
                                    }
                                  })()}`
                                : ''}
                            </p>
                          </div>
                          <StatusPill status={row.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="space-y-4">
            {listLoading && !notifications ? (
              <p className="text-sm text-[#888]">Loading notifications…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {Object.entries(notifications?.summary ?? {}).map(([key, value], i) => {
                    const colors = ['#27a9e3', '#28b779', '#da542e', '#ffb848', '#2255a4'];
                    return (
                      <div key={key} className="px-3 py-4 text-center text-white" style={{ backgroundColor: colors[i % colors.length] }}>
                        <p className="text-2xl font-black">{value}</p>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-white/85">{key}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="border border-[#cfe9f5] bg-white">
                    <div className="bg-[#27a9e3] px-4 py-2 text-sm font-bold text-white">Inbox</div>
                    <ul className="max-h-80 divide-y divide-[#eef6fb] overflow-y-auto">
                      {(notifications?.inbox ?? []).map((row) => (
                        <li key={String(row.id)} className="px-4 py-3 text-sm">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setDetail({ kind: 'notifications', ...row })}
                          >
                            <p className="font-semibold text-[#444]">{cell(row.title)}</p>
                            <p className="mt-0.5 text-xs text-[#888]">
                              {cell(row.type)} · {cell(row.user)} · {cell(row.createdAt)}
                            </p>
                          </button>
                        </li>
                      ))}
                      {(notifications?.inbox ?? []).length === 0 && (
                        <li className="px-4 py-6 text-sm text-[#999]">No inbox items.</li>
                      )}
                    </ul>
                  </div>
                  <div className="border border-[#c8eadb] bg-white">
                    <div className="bg-[#28b779] px-4 py-2 text-sm font-bold text-white">WhatsApp</div>
                    <ul className="max-h-80 divide-y divide-[#eaf7f1] overflow-y-auto">
                      {(notifications?.whatsapp ?? []).map((row) => (
                        <li key={String(row.id)} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setDetail({ kind: 'notifications', ...row })}
                          >
                            <p className="font-semibold text-[#444]">{cell(row.template) || 'Message'}</p>
                            <p className="mt-0.5 text-xs text-[#888]">
                              {cell(row.to)} · {cell(row.direction)} · {cell(row.createdAt)}
                              {row.error ? ` · ${cell(row.error)}` : ''}
                            </p>
                          </button>
                          <StatusPill status={String(row.status ?? '')} />
                        </li>
                      ))}
                      {(notifications?.whatsapp ?? []).length === 0 && (
                        <li className="px-4 py-6 text-sm text-[#999]">No WhatsApp messages.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-4">
            {listLoading && !reports ? (
              <p className="text-sm text-[#888]">Loading reports…</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {reportBlocks.map((block, idx) => {
                  const accents = ['#1f9d68', '#0aa3c2', '#d97706', '#da542e', '#852b99'];
                  const accent = accents[idx % accents.length]!;
                  const scalarEntries = block.entries.filter(([, value]) => !Array.isArray(value));
                  const listEntries = block.entries.filter(([, value]) => Array.isArray(value));
                  return (
                    <div
                      key={block.title}
                      className="overflow-hidden border border-[#ddd] bg-white shadow-sm md:col-span-1"
                      style={{ borderTop: `5px solid ${accent}` }}
                    >
                      <div className="border-b border-[#eee] px-4 py-3" style={{ backgroundColor: `${accent}14` }}>
                        <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: accent }}>
                          {block.title}
                        </h2>
                      </div>
                      {scalarEntries.length > 0 && (
                        <div className="grid grid-cols-2 gap-px bg-[#eee]">
                          {scalarEntries.map(([key, value]) => (
                            <div key={key} className="bg-white px-3 py-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">{key}</p>
                              <p className="mt-1 text-lg font-black text-[#444]">{cell(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {listEntries.map(([key, value]) => {
                        const rows = value as Array<Record<string, unknown>>;
                        return (
                          <div key={key} className="border-t border-[#eee] px-3 py-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#999]">{key}</p>
                            <ul className="space-y-2">
                              {rows.slice(0, 8).map((item, i) => (
                                <li
                                  key={i}
                                  className="flex items-center justify-between gap-2 rounded border border-[#f0f0f0] bg-[#fafafa] px-3 py-2 text-sm"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-[#444]">
                                      {cell(item.feature ?? item.email ?? item.name ?? item.userId)}
                                    </p>
                                    <p className="text-xs text-[#888]">
                                      {item.tokens != null ? `${cell(item.tokens)} tokens` : null}
                                      {item.estimatedCostInr != null ? ` · ₹${cell(item.estimatedCostInr)}` : null}
                                      {item.userType ? ` · ${cell(item.userType)}` : null}
                                      {item.requests != null && item.feature ? ` · ${cell(item.requests)} calls` : null}
                                    </p>
                                  </div>
                                  {item.requests != null ? (
                                    <span
                                      className="shrink-0 rounded px-2 py-0.5 text-xs font-bold text-white"
                                      style={{ backgroundColor: accent }}
                                    >
                                      {cell(item.requests)}
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                              {rows.length === 0 && <li className="text-xs text-[#999]">No rows.</li>}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
            {!listLoading && !reports && <p className="text-sm text-[#888]">No report data.</p>}
          </div>
        )}

        {tab === 'settings' && superAdmin && (
          <div className="border border-[#ddd] bg-white">
            <div className="bg-[#555] px-4 py-3 text-sm font-bold uppercase tracking-wide text-white">
              Platform configuration
            </div>
            <p className="border-b border-[#eee] bg-[#fafafa] px-4 py-2 text-xs text-[#777]">
              Controlled settings from the Super Admin workflow — Platform, Resume, ATS, AI,
              Notifications, System only.
            </p>
            {listLoading && Object.keys(settings).length === 0 ? (
              <p className="p-4 text-sm text-[#888]">Loading settings…</p>
            ) : (
              <form onSubmit={onSaveSettings} className="space-y-5 p-4">
                {SETTINGS_SCHEMA.map((section) => (
                  <div key={section.group}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[#555]">
                      {section.title}
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {section.fields.map((field) => {
                        const value = settings[field.key] ?? '';
                        const isOn = value === 'true' || value === '1';
                        return (
                          <label key={field.key} className="block border border-[#eee] bg-[#fafafa] p-3">
                            <span className="mb-1 block text-[11px] font-bold text-[#444]">
                              {field.label}
                            </span>
                            {field.kind === 'toggle' ? (
                              <select
                                className="w-full border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#555]"
                                value={isOn ? 'true' : 'false'}
                                onChange={(e) =>
                                  setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                              >
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                              </select>
                            ) : (
                              <input
                                className="w-full border border-[#ddd] bg-white px-3 py-2 text-sm outline-none focus:border-[#555]"
                                value={value}
                                onChange={(e) =>
                                  setSettings((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button type="submit" className="bg-[#555] px-4 py-2 text-sm font-bold text-white">
                  Save settings
                </button>
              </form>
            )}
          </div>
        )}

        {tab === 'audit' && (
          <div className="space-y-4">
            <SearchBar
              accent={theme.accent}
              value={search}
              onChange={setSearch}
              onSubmit={onSearchSubmit}
              placeholder="Search action, resource, id…"
            />
            <div className="overflow-hidden border border-[#f0e0c0] bg-[#fffdf8]">
              <div className="bg-[#ffb848] px-4 py-2 text-sm font-bold text-[#5c3d00]">Chronological trail</div>
              {listLoading ? (
                <p className="p-4 text-sm text-[#888]">Loading audit…</p>
              ) : (
                <ol className="relative space-y-0 border-l-2 border-[#ffb848]/40 ml-6 py-2">
                  {auditRows.map((row) => (
                    <li key={String(row.id)} className="relative py-3 pl-6 pr-4">
                      <span className="absolute -left-[7px] top-5 h-3 w-3 rounded-full bg-[#ffb848]" />
                      <p className="text-[11px] font-mono text-[#9a6a12]">{cell(row.time)}</p>
                      <p className="font-bold text-[#444]">{cell(row.action)}</p>
                      <p className="text-xs text-[#777]">
                        {cell(row.actor)} · {cell(row.resourceType)} · {cell(row.resourceId)}
                      </p>
                    </li>
                  ))}
                  {auditRows.length === 0 && <li className="py-6 pl-6 text-sm text-[#999]">No audit entries.</li>}
                </ol>
              )}
            </div>
          </div>
        )}

        {LIST_TABS.includes(tab) && (
          <div className="space-y-4">
            <SearchBar
              accent={theme.accent}
              value={search}
              onChange={setSearch}
              onSubmit={onSearchSubmit}
              placeholder={`Search ${tab}…`}
              filter={
                tab === 'jobs' ||
                tab === 'applications' ||
                tab === 'interviews' ||
                tab === 'candidates' ||
                tab === 'employers' ||
                tab === 'admins' ? (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border border-[#ddd] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">All statuses</option>
                    {tab === 'jobs' &&
                      ['DRAFT', 'PUBLISHED', 'PAUSED', 'CLOSED'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    {tab === 'applications' &&
                      [
                        'APPLIED',
                        'UNDER_REVIEW',
                        'SHORTLISTED',
                        'INTERVIEW',
                        'SELECTED',
                        'HIRED',
                        'REJECTED',
                        'WITHDRAWN',
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    {tab === 'interviews' &&
                      ['PROPOSED', 'SCHEDULED', 'CONFIRMED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'CANCELLED'].map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ),
                      )}
                    {(tab === 'candidates' || tab === 'employers' || tab === 'admins') &&
                      ['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                ) : null
              }
            />

            {tab === 'skills' && canManageSkills(staffRole) && (
              <div className="border border-[#e4d0ec] bg-[#fbf6fd] p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#5c1d6a]">Add skill</h3>
                <form onSubmit={onCreateSkill} className="grid gap-2 md:grid-cols-4">
                  <input
                    required
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Name"
                    className="border border-[#d8bde4] bg-white px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={skillCategory}
                    onChange={(e) => setSkillCategory(e.target.value)}
                    placeholder="Category"
                    className="border border-[#d8bde4] bg-white px-3 py-2 text-sm"
                  />
                  <input
                    value={skillAliases}
                    onChange={(e) => setSkillAliases(e.target.value)}
                    placeholder="Aliases"
                    className="border border-[#d8bde4] bg-white px-3 py-2 text-sm"
                  />
                  <button type="submit" className="bg-[#852b99] px-4 py-2 text-sm font-bold text-white">
                    Create skill
                  </button>
                </form>
              </div>
            )}

            {tab === 'admins' && canManageAdmins(staffRole) && (
              <div className="border border-[#2b3643]/20 bg-[#2b3643] p-4 text-white">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-white/80">Create platform staff</h3>
                <form onSubmit={onCreateAdmin} className="grid gap-2 md:grid-cols-3">
                  <input
                    required
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Email"
                    className="border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                  />
                  <input
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Full name"
                    className="border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                  />
                  <input
                    required
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Password (visible to Super Admin)"
                    minLength={8}
                    autoComplete="new-password"
                    className="border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                  />
                  <input
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="border-0 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50"
                  />
                  <select
                    value={adminRole}
                    onChange={(e) =>
                      setAdminRole(e.target.value as 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR')
                    }
                    className="border-0 bg-white/10 px-3 py-2 text-sm text-white"
                  >
                    <option value="PLATFORM_OPERATOR" className="text-[#333]">
                      Platform operator
                    </option>
                    <option value="PLATFORM_ADMIN" className="text-[#333]">
                      Platform admin
                    </option>
                    <option value="SUPER_ADMIN" className="text-[#333]">
                      Super admin
                    </option>
                  </select>
                  <button type="submit" className="bg-[#27a9e3] px-4 py-2 text-sm font-bold text-white">
                    Create admin
                  </button>
                </form>
              </div>
            )}

            {listLoading && <p className="text-sm text-[#888]">Loading {tab}…</p>}

            {!listLoading && rows.length === 0 && (
              <div className="border border-dashed border-[#ccc] bg-white px-4 py-10 text-center text-sm text-[#999]">
                No records found.
              </div>
            )}

            {tab === 'candidates' && !listLoading && rows.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.accountStatus ?? '');
                  const name = String(row.name ?? '—');
                  const skills = Array.isArray(row.primarySkills) ? row.primarySkills.map(String) : [];
                  const completion = Number(row.profileCompletion ?? 0);
                  return (
                    <article key={id} className="border border-[#d5ebf6] bg-white shadow-sm">
                      <div className="flex items-center gap-3 bg-[#27a9e3] px-4 py-3 text-white">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{name}</p>
                          <p className="truncate text-xs text-white/80">{cell(row.email)}</p>
                        </div>
                      </div>
                      <div className="space-y-2 p-4 text-sm">
                        <p className="text-[#666]">{cell(row.location)}</p>
                        <div className="h-2 overflow-hidden rounded bg-[#e8f4fb]">
                          <div className="h-full bg-[#27a9e3]" style={{ width: `${Math.min(100, completion)}%` }} />
                        </div>
                        <p className="text-[11px] font-semibold text-[#1a6d96]">Profile {completion}%</p>
                        <p className="line-clamp-2 text-xs text-[#777]">
                          Skills: {skills.length ? skills.join(', ') : '—'}
                        </p>
                        <div className="flex items-center justify-between">
                          <StatusPill status={status} />
                          <span className="text-xs font-semibold text-[#27a9e3]">
                            {cell(row.applications)} apps · {cell(row.resumeCount)} resumes
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <ActionBtn accent="#27a9e3" onClick={() => void openDetail('candidates', id)}>
                            View
                          </ActionBtn>
                          <ActionBtn
                            accent="#28b779"
                            disabled={!id || busyId === id || status === 'ACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminCandidateStatus(id, 'ACTIVE'), 'Candidate activated.')
                            }
                          >
                            Activate
                          </ActionBtn>
                          <ActionBtn
                            accent="#ffb848"
                            disabled={!id || busyId === id || status === 'INACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminCandidateStatus(id, 'INACTIVE'), 'Candidate deactivated.')
                            }
                          >
                            Deactivate
                          </ActionBtn>
                          <ActionBtn
                            danger
                            disabled={!id || busyId === id || status === 'SUSPENDED'}
                            onClick={() =>
                              void runAction(id, () => setAdminCandidateStatus(id, 'SUSPENDED'), 'Candidate suspended.')
                            }
                          >
                            Suspend
                          </ActionBtn>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'employers' && !listLoading && rows.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.accountStatus ?? '');
                  const verified = Boolean(row.verified);
                  return (
                    <article key={id} className="flex overflow-hidden border border-[#c8eadb] bg-white">
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: verified ? '#28b779' : '#ffb848' }} />
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-[#333]">{cell(row.companyName)}</h3>
                            <p className="text-xs text-[#777]">{cell(row.email)}</p>
                          </div>
                          <StatusPill status={status} />
                        </div>
                        <p className="mt-2 text-xs text-[#666]">
                          {verified ? 'Verified employer' : 'Pending verification'} · {cell(row.jobs)} jobs
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <ActionBtn accent="#28b779" onClick={() => void openDetail('employers', id)}>
                            View
                          </ActionBtn>
                          <ActionBtn
                            accent="#27a9e3"
                            disabled={!id || verified || busyId === id}
                            onClick={() => void runAction(id, () => verifyEmployer(id), 'Employer verified.')}
                          >
                            Verify
                          </ActionBtn>
                          <ActionBtn
                            accent="#28b779"
                            disabled={!id || busyId === id || status === 'ACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminEmployerStatus(id, 'ACTIVE'), 'Employer activated.')
                            }
                          >
                            Activate
                          </ActionBtn>
                          <ActionBtn
                            accent="#ffb848"
                            disabled={!id || busyId === id || status === 'INACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminEmployerStatus(id, 'INACTIVE'), 'Employer deactivated.')
                            }
                          >
                            Deactivate
                          </ActionBtn>
                          <ActionBtn
                            danger
                            disabled={!id || busyId === id || status === 'SUSPENDED'}
                            onClick={() =>
                              void runAction(id, () => setAdminEmployerStatus(id, 'SUSPENDED'), 'Employer suspended.')
                            }
                          >
                            Suspend
                          </ActionBtn>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'jobs' && !listLoading && rows.length > 0 && (
              <div className="space-y-2">
                {rows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.status ?? '');
                  const bar =
                    status === 'PUBLISHED'
                      ? '#28b779'
                      : status === 'PAUSED'
                        ? '#ffb848'
                        : status === 'CLOSED'
                          ? '#da542e'
                          : '#27a9e3';
                  return (
                    <article key={id} className="flex items-stretch border border-[#eee] bg-white">
                      <div className="w-2 shrink-0" style={{ backgroundColor: bar }} />
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-bold text-[#444]">{cell(row.title)}</p>
                          <p className="text-xs text-[#777]">
                            {cell(row.companyName)} · {cell(row.city)} · {cell(row.applications)} apps
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={status} />
                          <ActionBtn accent="#ffb848" onClick={() => void openDetail('jobs', id)}>
                            View
                          </ActionBtn>
                          {canManageJobs(staffRole) ? (
                            <>
                              <ActionBtn
                                accent="#28b779"
                                disabled={!id || busyId === id || status === 'PUBLISHED'}
                                onClick={() =>
                                  void runAction(id, () => setAdminJobStatus(id, 'PUBLISHED'), 'Job published.')
                                }
                              >
                                Publish
                              </ActionBtn>
                              <ActionBtn
                                accent="#ffb848"
                                disabled={!id || busyId === id || status === 'PAUSED'}
                                onClick={() =>
                                  void runAction(id, () => setAdminJobStatus(id, 'PAUSED'), 'Job paused.')
                                }
                              >
                                Pause
                              </ActionBtn>
                              <ActionBtn
                                danger
                                disabled={!id || busyId === id || status === 'CLOSED'}
                                onClick={() =>
                                  void runAction(id, () => setAdminJobStatus(id, 'CLOSED'), 'Job closed.')
                                }
                              >
                                Close
                              </ActionBtn>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'applications' && !listLoading && rows.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => (
                  <article
                    key={String(row.id)}
                    className="relative overflow-hidden border border-[#f3d5cb] bg-[#fff9f7] p-4"
                  >
                    <div className="absolute right-0 top-0 bg-[#da542e] px-2 py-1 text-[10px] font-bold uppercase text-white">
                      {cell(row.status)}
                    </div>
                    <p className="pr-16 font-bold text-[#444]">{cell(row.candidateName)}</p>
                    <p className="mt-1 text-sm text-[#666]">{cell(row.jobTitle)}</p>
                    <p className="text-xs text-[#999]">{cell(row.companyName)}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs font-bold text-[#da542e]">Match {cell(row.matchScore)}</span>
                      <ActionBtn accent="#da542e" onClick={() => void openDetail('applications', String(row.id))}>
                        View
                      </ActionBtn>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {tab === 'interviews' && !listLoading && rows.length > 0 && (
              <div className="space-y-3">
                {rows.map((row) => (
                  <article
                    key={String(row.id)}
                    className="grid gap-3 border border-[#d5dff0] bg-white p-4 md:grid-cols-[140px_1fr_auto]"
                  >
                    <div className="bg-[#2255a4] px-3 py-3 text-center text-white">
                      <p className="text-[10px] uppercase tracking-wide text-white/70">Scheduled</p>
                      <p className="mt-1 text-xs font-bold leading-snug">{cell(row.scheduledAt)}</p>
                    </div>
                    <div>
                      <p className="font-bold text-[#333]">{cell(row.candidateName)}</p>
                      <p className="text-sm text-[#666]">{cell(row.jobTitle)}</p>
                      <p className="text-xs text-[#888]">{cell(row.companyName)}</p>
                      <p className="mt-1 text-[11px] text-[#2255a4]">
                        Mode {cell(row.mode)} · WhatsApp {cell(row.whatsappStatus)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-2">
                      <StatusPill status={String(row.status ?? '')} />
                      <ActionBtn accent="#2255a4" onClick={() => void openDetail('interviews', String(row.id))}>
                        View
                      </ActionBtn>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {tab === 'skills' && !listLoading && rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {rows.map((row) => (
                    <span
                      key={`chip-${String(row.id)}`}
                      className="rounded-full px-3 py-1 text-xs font-bold text-white"
                      style={{ backgroundColor: Boolean(row.active) ? '#852b99' : '#999' }}
                    >
                      {cell(row.name)}
                    </span>
                  ))}
                </div>
                <div className="overflow-hidden border border-[#e4d0ec] bg-white">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-[#852b99] text-xs uppercase tracking-wide text-white">
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Aliases</th>
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const id = String(row.id ?? '');
                        const active = Boolean(row.active);
                        return (
                          <tr key={id} className="border-t border-[#f0e6f5]">
                            <td className="px-3 py-2.5 font-semibold">{cell(row.name)}</td>
                            <td className="px-3 py-2.5">{cell(row.category)}</td>
                            <td className="px-3 py-2.5 text-[#666]">{cell(row.aliases)}</td>
                            <td className="px-3 py-2.5">
                              <StatusPill status={active ? 'ACTIVE' : 'INACTIVE'} />
                            </td>
                            <td className="px-3 py-2.5">
                              {canManageSkills(staffRole) ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <ActionBtn
                                    accent="#2255a4"
                                    disabled={!id || busyId === id}
                                    onClick={() => {
                                      const name = window.prompt('Skill name', String(row.name ?? ''))?.trim();
                                      if (!name) return;
                                      const category =
                                        window.prompt('Category', String(row.category ?? ''))?.trim() || undefined;
                                      const aliases =
                                        window.prompt('Aliases (comma separated)', String(row.aliases ?? '')) ??
                                        undefined;
                                      void runAction(
                                        id,
                                        () =>
                                          updateAdminSkill(id, {
                                            name,
                                            category,
                                            aliases: aliases === undefined ? undefined : aliases,
                                          }),
                                        'Skill updated.',
                                      );
                                    }}
                                  >
                                    Edit
                                  </ActionBtn>
                                  <ActionBtn
                                    accent="#852b99"
                                    disabled={!id || busyId === id}
                                    onClick={() =>
                                      void runAction(
                                        id,
                                        () => updateAdminSkill(id, { active: !active }),
                                        active ? 'Skill deactivated.' : 'Skill activated.',
                                      )
                                    }
                                  >
                                    {active ? 'Deactivate' : 'Activate'}
                                  </ActionBtn>
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'admins' && !listLoading && rows.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.status ?? '');
                  const role = String(row.userType ?? '');
                  const password = row.password != null && String(row.password).length > 0 ? String(row.password) : null;
                  const canSuspend = superAdmin && role !== 'SUPER_ADMIN' && status !== 'SUSPENDED';
                  return (
                    <article key={id} className="border border-[#2b3643]/15 bg-[#f7f8fa] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-[#2b3643]">{cell(row.fullName) || cell(row.email)}</p>
                          <p className="text-xs text-[#777]">{cell(row.email)}</p>
                        </div>
                        <span className="rounded bg-[#2b3643] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          {role}
                        </span>
                      </div>
                      <div className="mt-3 rounded border border-[#2b3643]/10 bg-white px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#999]">Login password</p>
                        <p className="mt-0.5 font-mono text-sm text-[#2b3643]">
                          {password || 'Not stored — set a new password'}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <StatusPill status={status} />
                        <span className="text-[11px] text-[#999]">{cell(row.createdAt)}</span>
                      </div>
                      {superAdmin ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <ActionBtn
                            accent="#28b779"
                            disabled={!id || busyId === id || status === 'ACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setPlatformAdminStatus(id, 'ACTIVE'), 'Admin activated.')
                            }
                          >
                            Activate
                          </ActionBtn>
                          <ActionBtn
                            accent="#ffb848"
                            disabled={!id || busyId === id || status === 'INACTIVE' || role === 'SUPER_ADMIN'}
                            onClick={() =>
                              void runAction(id, () => setPlatformAdminStatus(id, 'INACTIVE'), 'Admin deactivated.')
                            }
                          >
                            Deactivate
                          </ActionBtn>
                          <ActionBtn
                            danger
                            disabled={!canSuspend || busyId === id}
                            onClick={() =>
                              void runAction(id, () => setPlatformAdminStatus(id, 'SUSPENDED'), 'Admin suspended.')
                            }
                          >
                            Suspend
                          </ActionBtn>
                          <ActionBtn
                            accent="#2b3643"
                            disabled={!id || busyId === id || role === 'SUPER_ADMIN'}
                            onClick={() => {
                              const picked = window
                                .prompt(
                                  'New role (PLATFORM_OPERATOR | PLATFORM_ADMIN | SUPER_ADMIN)',
                                  role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : role,
                                )
                                ?.trim()
                                .toUpperCase();
                              if (
                                !picked ||
                                !['PLATFORM_OPERATOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(picked)
                              ) {
                                return;
                              }
                              void runAction(
                                id,
                                () =>
                                  setPlatformAdminRole(
                                    id,
                                    picked as 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR',
                                  ),
                                'Admin role updated.',
                              );
                            }}
                          >
                            Change role
                          </ActionBtn>
                          <ActionBtn
                            accent="#27a9e3"
                            disabled={!id || busyId === id}
                            onClick={() => {
                              const next = window
                                .prompt('Set login password (min 8 characters)', password || '')
                                ?.trim();
                              if (!next || next.length < 8) return;
                              void runAction(
                                id,
                                () => setPlatformAdminPassword(id, next),
                                `Password set: ${next}`,
                              );
                            }}
                          >
                            Set password
                          </ActionBtn>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </ModuleCanvas>
      </div>
    </SuperAdminShell>
  );
}
