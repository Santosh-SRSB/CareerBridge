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
  impersonateAdminEmployer,
  setAdminCandidateStatus,
  setAdminEmployerStatus,
  setAdminJobStatus,
  approveAdminJob,
  rejectAdminJob,
  setPlatformAdminRole,
  setPlatformAdminStatus,
  setPlatformAdminPassword,
  updateAdminSettings,
  updateAdminSkill,
  verifyEmployer,
  getAdminAiUsage,
  getAdminTestimonials,
  reviewAdminTestimonial,
} from '@/lib/api';
import { SuperAdminShell } from '@/components/super-admin/SuperAdminShell';
import { PlatformCatalogSettings } from '@/components/super-admin/PlatformCatalogSettings';
import { AdminChangePasswordForm } from '@/components/super-admin/AdminChangePasswordForm';
import { ReportExportPanel } from '@/components/super-admin/ReportExportPanel';
import { EmployerJobReportPanel } from '@/components/super-admin/EmployerJobReportPanel';
import { CandidateProgressPanel, EmployerProgressPanel } from '@/components/super-admin/ProgressPiePanel';
import { AccountDeleteDialog } from '@/components/super-admin/AccountDeleteDialog';
import { type AdminDeletableKind, canOfferAccountDeletion } from '@/lib/admin-account-deletion';
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
  canImpersonateEmployer,
  canManageAdmins,
  canManageJobs,
  canManageSkills,
  canOpenAdminTab,
  type SuperAdminNavId,
} from '@/lib/admin-portal';
import {
  ADMIN_INTERVIEW_STATUS_OPTIONS,
  adminInterviewStatusLabel,
  adminWhatsAppStatusLabel,
} from '@/lib/admin-interview-status';
import { beginEmployerImpersonation, getStoredUser, isPlatformRole, isSuperAdminRole } from '@/lib/session';
import { RoleDashboardHome, roleDashboardHero } from '@/components/super-admin/role-dashboard-home';
import {
  ApplicationPipelinePanel,
  CandidateFilterBar,
  EMPTY_CANDIDATE_FILTERS,
  FunnelConversionPanel,
  RevenuePanel,
  SkillMergeControl,
  WhatsAppDeliveryPanel,
  type CandidateFilters,
} from '@/components/super-admin/admin-insights';
import type { AdminFunnelStage, AdminWhatsAppDelivery } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';
import { sortRows } from '@/lib/table-sort';

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
  'testimonials',
  'reports',
  'admins',
  'settings',
  'audit',
  'account',
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

type ListSort = 'default' | 'name-asc' | 'name-desc' | 'newest' | 'oldest' | 'status';

const LIST_SORT_OPTIONS: Array<{ value: ListSort; label: string }> = [
  { value: 'default', label: 'Sort: Default' },
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'status', label: 'Status' },
];

function rowName(row: Record<string, unknown>): string | null {
  const value =
    row.name ?? row.companyName ?? row.title ?? row.candidateName ?? row.fullName ?? row.email ?? null;
  return value == null || value === '' ? null : String(value);
}

function rowTime(row: Record<string, unknown>): number | null {
  const raw = row.createdAt ?? row.scheduledAt ?? null;
  if (raw == null || raw === '') return null;
  const time = new Date(String(raw)).getTime();
  return Number.isNaN(time) ? null : time;
}

function sortAdminRows(rows: Array<Record<string, unknown>>, sort: ListSort) {
  switch (sort) {
    case 'name-asc':
      return sortRows(rows, rowName, 'asc');
    case 'name-desc':
      return sortRows(rows, rowName, 'desc');
    case 'newest':
      return sortRows(rows, rowTime, 'desc');
    case 'oldest':
      return sortRows(rows, rowTime, 'asc');
    case 'status':
      return sortRows(rows, (row) => String(row.adminStatusLabel ?? row.accountStatus ?? row.status ?? '') || null, 'asc');
    default:
      return rows;
  }
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
  const [candidateFilters, setCandidateFilters] = useState<CandidateFilters>(EMPTY_CANDIDATE_FILTERS);
  const [pipelineRefresh, setPipelineRefresh] = useState(0);
  const [metrics, setMetrics] = useState<AdminDashboard | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [listSort, setListSort] = useState<ListSort>('default');
  const sortedRows = useMemo(() => sortAdminRows(rows, listSort), [rows, listSort]);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: AdminDeletableKind; id: string; name: string } | null>(
    null,
  );

  const [notifications, setNotifications] = useState<{
    summary: Record<string, number>;
    inbox: Array<Record<string, unknown>>;
    whatsapp: Array<Record<string, unknown>>;
    delivery?: AdminWhatsAppDelivery;
  } | null>(null);
  const [testimonials, setTestimonials] = useState<
    Array<{
      id: string;
      audience: string;
      source: string;
      rating: number;
      quote: string;
      displayName: string | null;
      headline: string | null;
      status: string;
      rejectReason: string | null;
      reviewedAt: string | null;
      createdAt: string;
      user: {
        email: string | null;
        phone: string;
        userType: string;
        name: string | null;
        company: string | null;
      };
    }>
  >([]);
  const [testimonialFilter, setTestimonialFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | ''>(
    'PENDING',
  );
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
      router.replace('/adminsrsb');
      return;
    }
    setSuperAdmin(isSuperAdminRole(user.role));
    setStaffRole(user.role);
    setReady(true);
    getAdminDashboard()
      .then(setMetrics)
      .catch(() => {
        setError('Could not load dashboard metrics.');
        router.replace('/adminsrsb');
      });
  }, [router]);

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
    setError('');
    setOk('');
    setDetail(null);
    setStatusFilter('');
    setCandidateFilters(EMPTY_CANDIDATE_FILTERS);
  }, [tab]);

  useEffect(() => {
    if (!ready) return;
    if (!canOpenAdminTab(staffRole, tab)) {
      router.replace('/adminsrsb/dashboard');
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
      if (
        statusFilter &&
        (tab === 'jobs' || tab === 'applications' || tab === 'interviews' || tab === 'candidates')
      ) {
        params.set('status', statusFilter);
      }
      if (tab === 'candidates') {
        if (candidateFilters.location) params.set('location', candidateFilters.location);
        if (candidateFilters.skill) params.set('skill', candidateFilters.skill);
        if (candidateFilters.from) params.set('from', candidateFilters.from);
        if (candidateFilters.to) params.set('to', candidateFilters.to);
      }
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await getAdminList(`${tab}${suffix}`);
      let next = asRows(data);
      if (statusFilter && (tab === 'employers' || tab === 'admins')) {
        next = next.filter((row) => String(row.accountStatus ?? row.status ?? '') === statusFilter);
      }
      setRows(next);
    } catch (err) {
      setRows([]);
      setError(userFacingError(err, `load ${tab}`));
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

    if (tab === 'testimonials') {
      setListLoading(true);
      getAdminTestimonials(testimonialFilter || undefined)
        .then(setTestimonials)
        .catch(() => {
          setTestimonials([]);
          setError('Could not load testimonials.');
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
  }, [ready, tab, appliedSearch, superAdmin, statusFilter, testimonialFilter, candidateFilters]);

  const reportBlocks = useMemo(() => {
    if (!reports) return [] as Array<{ title: string; entries: Array<[string, unknown]> }>;
    return Object.entries(reports)
      .filter(([title]) => title !== 'funnel')
      .map(([title, value]) => ({
        title,
        entries:
          value && typeof value === 'object' && !Array.isArray(value)
            ? Object.entries(value as Record<string, unknown>)
            : [['value', value]],
      }));
  }, [reports]);

  const reportFunnel = useMemo(
    () => (Array.isArray(reports?.funnel) ? (reports.funnel as AdminFunnelStage[]) : []),
    [reports],
  );

  async function runAction(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setError('');
    setOk('');
    try {
      await action();
      setOk(success);
      if (LIST_TABS.includes(tab)) await reloadList(appliedSearch);
      if (tab === 'applications') setPipelineRefresh((n) => n + 1);
      if (tab === 'testimonials') {
        setTestimonials(await getAdminTestimonials(testimonialFilter || undefined));
      }
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

  function onAccountDeleted(result: { kind: AdminDeletableKind; id: string; displayName: string }) {
    setDeleteTarget(null);
    setError('');
    setRows((prev) => prev.filter((row) => String(row.id ?? '') !== result.id));
    setDetail((prev) => (prev && String(prev.id ?? '') === result.id ? null : prev));
    setOk(`${result.displayName} was permanently deleted.`);
    void reloadList(appliedSearch);
  }

  async function openEmployerWorkspace(
    employerId: string,
    path: '/employer' | '/employer/jobs/new' | '/employer/candidates' | '/employer/interviews' = '/employer',
  ) {
    if (!canImpersonateEmployer(staffRole)) {
      setError('Only super admins and platform admins can open an employer workspace.');
      return;
    }
    setBusyId(`impersonate-${employerId}`);
    setError('');
    setOk('');
    try {
      const session = await impersonateAdminEmployer(employerId);
      beginEmployerImpersonation(session, {
        employerId: session.impersonation.employerId,
        companyName: session.impersonation.companyName,
        adminUserId: session.impersonation.adminUserId,
      });
      setOk(`Opened workspace for ${session.impersonation.companyName}.`);
      router.push(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open employer workspace.');
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

  async function openDetail(
    kind: 'candidates' | 'employers' | 'jobs' | 'applications' | 'interviews',
    id: string,
    extra?: Record<string, unknown>,
  ) {
    setError('');
    setOk('');
    try {
      const row = await getAdminRecord(`${kind}/${id}`);
      setDetail({ kind, ...row, ...extra });
      // Scroll detail into view after paint.
      requestAnimationFrame(() => {
        document.getElementById('admin-record-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load details.');
    }
  }

  if (!ready) {
    return (
      <main className="role-shell min-h-screen p-8 text-sm">
        <span className="sa-muted">Checking access…</span>
      </main>
    );
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
                className={`${hero.className} sa-hero mb-1 flex flex-wrap items-end justify-between gap-2 px-4 py-3 sm:px-5`}
              >
                <div>
                  <p className="sa-eyebrow">{hero.eyebrow}</p>
                  <h1 className="sa-h1">{hero.title}</h1>
                  <p className="sa-muted text-xs">{hero.blurb}</p>
                </div>
                <p className="sa-crumb">
                  Home <span className="mx-1">›</span> Dashboard
                </p>
              </div>
            );
          })()
        ) : (
          <ModuleBanner tab={tab} />
        )}

        {(error || ok) && (
          <div className={`sa-notice px-4 py-3 text-sm font-semibold ${error ? 'sa-notice--error' : ''}`}>
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
              <p className="sa-muted text-sm">Loading metrics…</p>
            ) : (
              <>
                <RoleDashboardHome role={staffRole} metrics={metrics} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="sa-card p-4">
                    <h2 className="sa-h2 mb-3 text-base">Recent activity</h2>
                    <ul className="sa-rows space-y-2 text-sm">
                      {(metrics.recentActivity ?? []).map((item) => (
                        <li key={`${item.at}-${item.label}`} className="sa-ink flex gap-3 py-2">
                          <span className="sa-muted w-14 shrink-0 text-xs font-semibold tabular-nums">{item.at.slice(11, 16)}</span>
                          <span>{item.label}</span>
                        </li>
                      ))}
                      {(metrics.recentActivity ?? []).length === 0 && (
                        <li className="sa-muted">No recent platform activity.</li>
                      )}
                    </ul>
                  </section>
                  <section className="sa-card p-4">
                    <h2 className="sa-h2 mb-3 text-base">System status</h2>
                    <ul className="sa-rows space-y-2 text-sm">
                      {(metrics.systemStatus ?? []).map((item) => (
                        <li key={item.name} className="sa-ink flex items-center justify-between py-2">
                          <span>{item.name}</span>
                          <span className={`sa-pill ${item.status === 'Healthy' ? 'sa-pill--ok' : 'sa-pill--warn'}`}>
                            {item.status}
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
              <p className="sa-muted text-sm">Loading AI usage…</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Total requests', value: metrics.aiUsage?.totalRequests ?? 0 },
                    { label: 'Failed', value: metrics.aiUsage?.failedRequests ?? 0 },
                    {
                      label: 'Estimated cost',
                      value: `₹${Number(metrics.aiUsage?.estimatedCostInr ?? 0).toLocaleString('en-IN')}`,
                    },
                    {
                      label: 'Tokens',
                      value: Number(metrics.aiUsage?.totalTokens ?? 0).toLocaleString('en-IN'),
                    },
                  ].map((card) => (
                    <div key={card.label} className="sa-kpi min-w-0 p-5 shadow-[var(--sa-shadow)]">
                      <p className="sa-label">{card.label}</p>
                      <p className="sa-value mt-2 text-3xl [overflow-wrap:anywhere]">{card.value}</p>
                    </div>
                  ))}
                </div>
                <div className="sa-dark rounded-[var(--sa-radius)] p-4">
                  <h2 className="sa-on-dark-muted mb-3 text-sm font-bold uppercase tracking-wide">Usage by feature</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(metrics.aiUsage?.byFeature ?? []).map((row) => (
                      <div key={row.feature} className="sa-dark-cell flex items-center justify-between gap-2 px-3 py-3">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold [overflow-wrap:anywhere]">{row.feature}</span>
                          <p className="sa-on-dark-muted text-[11px]">
                            {row.tokens ?? 0} tokens · ₹{Number(row.estimatedCostInr ?? 0).toLocaleString('en-IN')}
                          </p>
                        </div>
                        <span className="sa-badge px-2 py-0.5 text-xs">{row.requests}</span>
                      </div>
                    ))}
                    {(metrics.aiUsage?.byFeature ?? []).length === 0 && (
                      <p className="sa-on-dark-muted text-sm">No AI usage recorded yet.</p>
                    )}
                  </div>
                </div>
                {(metrics.aiUsage?.byUser?.length ?? 0) > 0 && (
                  <div className="sa-card overflow-hidden">
                    <div className="sa-panel-h sa-panel-h--brand px-4 py-2 text-sm">Usage by user</div>
                    <ul className="sa-rows">
                      {metrics.aiUsage!.byUser!.map((row) => (
                        <li key={String(row.userId ?? row.email)} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="sa-ink font-semibold [overflow-wrap:anywhere]">{row.email}</p>
                            <p className="sa-muted text-xs">
                              {row.userType || '—'} · {row.tokens} tokens · ₹{row.estimatedCostInr}
                            </p>
                          </div>
                          <span className="sa-badge px-2 py-0.5 text-xs">{row.requests}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(metrics.aiUsage?.recent?.length ?? 0) > 0 && (
                  <div className="sa-card overflow-hidden">
                    <div className="sa-panel-h px-4 py-2 text-sm">Recent AI calls</div>
                    <ul className="sa-rows">
                      {metrics.aiUsage!.recent!.map((row) => (
                        <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                          <div className="min-w-0">
                            <p className="sa-ink font-semibold [overflow-wrap:anywhere]">
                              {row.feature} · {row.provider}/{row.model}
                            </p>
                            <p className="sa-muted text-xs [overflow-wrap:anywhere]">
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
              <p className="sa-muted text-sm">Loading notifications…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                  {Object.entries(notifications?.summary ?? {}).map(([key, value]) => (
                    <div key={key} className="sa-alert min-w-0 px-3 py-4 text-center">
                      <p className="text-2xl font-extrabold">{value}</p>
                      <p className="sa-on-dark-muted mt-1 text-[10px] font-bold uppercase tracking-[0.1em] [overflow-wrap:anywhere]">
                        {key}
                      </p>
                    </div>
                  ))}
                </div>
                <WhatsAppDeliveryPanel delivery={notifications?.delivery} />
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="sa-card overflow-hidden">
                    <div className="sa-panel-h sa-panel-h--brand px-4 py-2 text-sm">Inbox</div>
                    <ul className="sa-rows max-h-80 overflow-y-auto">
                      {(notifications?.inbox ?? []).map((row) => (
                        <li key={String(row.id)} className="sa-row-hover px-4 py-3 text-sm">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setDetail({ kind: 'notifications', ...row })}
                          >
                            <p className="sa-ink font-semibold">{cell(row.title)}</p>
                            <p className="sa-muted mt-0.5 text-xs [overflow-wrap:anywhere]">
                              {cell(row.type)} · {cell(row.user)} · {cell(row.createdAt)}
                            </p>
                          </button>
                        </li>
                      ))}
                      {(notifications?.inbox ?? []).length === 0 && (
                        <li className="sa-muted px-4 py-6 text-sm">No inbox items.</li>
                      )}
                    </ul>
                  </div>
                  <div className="sa-card overflow-hidden">
                    <div className="sa-panel-h px-4 py-2 text-sm">WhatsApp</div>
                    <ul className="sa-rows max-h-80 overflow-y-auto">
                      {(notifications?.whatsapp ?? []).map((row) => (
                        <li key={String(row.id)} className="sa-row-hover flex items-start justify-between gap-3 px-4 py-3 text-sm">
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setDetail({ kind: 'notifications', ...row })}
                          >
                            <p className="sa-ink font-semibold">{cell(row.template) || 'Message'}</p>
                            <p className="sa-muted mt-0.5 text-xs [overflow-wrap:anywhere]">
                              {cell(row.to)} · {cell(row.direction)} · {cell(row.createdAt)}
                              {row.error ? ` · ${cell(row.error)}` : ''}
                            </p>
                          </button>
                          <StatusPill status={String(row.status ?? '')} />
                        </li>
                      ))}
                      {(notifications?.whatsapp ?? []).length === 0 && (
                        <li className="sa-muted px-4 py-6 text-sm">No WhatsApp messages.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'testimonials' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['PENDING', 'APPROVED', 'REJECTED', ''] as const).map((value) => (
                <button
                  key={value || 'ALL'}
                  type="button"
                  onClick={() => setTestimonialFilter(value)}
                  aria-pressed={testimonialFilter === value}
                  className="sa-chip min-h-9 px-3.5 text-[11px]"
                >
                  {value || 'ALL'}
                </button>
              ))}
            </div>
            {listLoading && testimonials.length === 0 ? (
              <p className="sa-muted text-sm">Loading testimonials…</p>
            ) : testimonials.length === 0 ? (
              <p className="sa-empty p-6 text-sm">No testimonials in this filter.</p>
            ) : (
              <div className="space-y-3">
                {testimonials.map((row) => (
                  <article key={row.id} className="sa-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={row.status} />
                        <span className="sa-label text-xs">
                          {row.audience} · {row.source}
                        </span>
                      </div>
                      <span className="sa-brand-text text-sm font-extrabold">{'★'.repeat(row.rating)}</span>
                    </div>
                    <p className="sa-ink mt-3 text-sm font-semibold leading-relaxed">“{row.quote}”</p>
                    <p className="sa-muted mt-2 text-xs">
                      {row.displayName || row.user.name || 'Member'}
                      {row.headline ? ` · ${row.headline}` : ''}
                      {row.user.company ? ` · ${row.user.company}` : ''}
                    </p>
                    <p className="sa-muted mt-1 text-[11px]">
                      {row.user.email || row.user.phone} · {new Date(row.createdAt).toLocaleString()}
                    </p>
                    {row.status === 'PENDING' && (staffRole === 'SUPER_ADMIN' || staffRole === 'PLATFORM_ADMIN') ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <ActionBtn
                          disabled={busyId === row.id}
                          onClick={() =>
                            void runAction(row.id, () => reviewAdminTestimonial(row.id, 'APPROVE'), 'Testimonial approved.')
                          }
                        >
                          Approve
                        </ActionBtn>
                        <ActionBtn
                          tone="strong"
                          disabled={busyId === row.id}
                          onClick={() =>
                            void runAction(
                              row.id,
                              () => reviewAdminTestimonial(row.id, 'REJECT', 'Not suitable for public page'),
                              'Testimonial rejected.',
                            )
                          }
                        >
                          Reject
                        </ActionBtn>
                        <ActionBtn onClick={() => setDetail({ kind: 'testimonials', ...row })}>View</ActionBtn>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <ActionBtn onClick={() => setDetail({ kind: 'testimonials', ...row })}>View</ActionBtn>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'reports' && (
          <div className="space-y-4">
            <ReportExportPanel />
            {listLoading && !reports ? (
              <p className="sa-muted text-sm">Loading reports…</p>
            ) : (
              <>
              <FunnelConversionPanel funnel={reportFunnel} />
              <div className="grid gap-4 lg:grid-cols-2" data-testid="progress-charts">
                <CandidateProgressPanel />
                <EmployerProgressPanel />
              </div>
              <RevenuePanel />
              <EmployerJobReportPanel />
              <div className="grid gap-4 md:grid-cols-2">
                {reportBlocks.map((block) => {
                  const scalarEntries = block.entries.filter(([, value]) => !Array.isArray(value));
                  const listEntries = block.entries.filter(([, value]) => Array.isArray(value));
                  return (
                    <div
                      key={block.title}
                      className="sa-card overflow-hidden border-t-[3px] border-t-[var(--sa-brand)] md:col-span-1"
                    >
                      <div className="sa-soft-h px-4 py-3">
                        <h2 className="text-sm font-bold uppercase tracking-wide">{block.title}</h2>
                      </div>
                      {scalarEntries.length > 0 && (
                        <div className="sa-gridlines grid grid-cols-2 gap-px">
                          {scalarEntries.map(([key, value]) => (
                            <div key={String(key)} className="min-w-0 px-3 py-3">
                              <p className="sa-label [overflow-wrap:anywhere]">{String(key)}</p>
                              <p className="sa-value mt-1 text-lg [overflow-wrap:anywhere]">{cell(value)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      {listEntries.map(([key, value]) => {
                        const rows = value as Array<Record<string, unknown>>;
                        return (
                          <div key={String(key)} className="border-t border-[var(--sa-line)] px-3 py-3">
                            <p className="sa-label mb-2">{String(key)}</p>
                            <ul className="space-y-2">
                              {rows.slice(0, 8).map((item, i) => (
                                <li
                                  key={i}
                                  className="sa-inset flex items-center justify-between gap-2 px-3 py-2 text-sm"
                                >
                                  <div className="min-w-0">
                                    <p className="sa-ink truncate font-semibold">
                                      {cell(item.feature ?? item.email ?? item.name ?? item.userId)}
                                    </p>
                                    <p className="sa-muted text-xs">
                                      {item.tokens != null ? `${cell(item.tokens)} tokens` : null}
                                      {item.estimatedCostInr != null ? ` · ₹${cell(item.estimatedCostInr)}` : null}
                                      {item.userType ? ` · ${cell(item.userType)}` : null}
                                      {item.requests != null && item.feature ? ` · ${cell(item.requests)} calls` : null}
                                    </p>
                                  </div>
                                  {item.requests != null ? (
                                    <span className="sa-badge shrink-0 px-2 py-0.5 text-xs">{cell(item.requests)}</span>
                                  ) : null}
                                </li>
                              ))}
                              {rows.length === 0 && <li className="sa-muted text-xs">No rows.</li>}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              </>
            )}
            {!listLoading && !reports && <p className="sa-muted text-sm">No report data.</p>}
          </div>
        )}

        {tab === 'settings' && superAdmin && <PlatformCatalogSettings />}

        {tab === 'settings' && superAdmin && (
          <div className="sa-card mt-4 overflow-hidden">
            <div className="sa-panel-h px-4 py-3 text-sm uppercase">Platform configuration</div>
            <p className="sa-note px-4 py-2 text-xs">
              Controlled settings from the Super Admin workflow — Platform, Resume, ATS, AI,
              Notifications, System only.
            </p>
            {listLoading && Object.keys(settings).length === 0 ? (
              <p className="sa-muted p-4 text-sm">Loading settings…</p>
            ) : (
              <form onSubmit={onSaveSettings} className="space-y-5 p-4">
                {SETTINGS_SCHEMA.map((section) => (
                  <div key={section.group}>
                    <h3 className="sa-label mb-2 text-xs">{section.title}</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {section.fields.map((field) => {
                        const value = settings[field.key] ?? '';
                        const isOn = value === 'true' || value === '1';
                        return (
                          <label key={field.key} className="sa-inset block p-3">
                            <span className="sa-ink mb-1 block text-[11px] font-bold">{field.label}</span>
                            {field.kind === 'toggle' ? (
                              <select
                                className="sa-input w-full px-3 py-2 text-sm"
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
                                className="sa-input w-full px-3 py-2 text-sm"
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
                <button type="submit" className="sa-btn">
                  Save settings
                </button>
              </form>
            )}
          </div>
        )}

        {tab === 'account' && <AdminChangePasswordForm email={getStoredUser()?.email} />}

        {tab === 'audit' && (
          <div className="space-y-4">
            <SearchBar
              accent={theme.accent}
              value={search}
              onChange={setSearch}
              onSubmit={onSearchSubmit}
              placeholder="Search action, resource, id…"
            />
            <div className="sa-card overflow-hidden">
              <div className="sa-panel-h px-4 py-2 text-sm">Chronological trail</div>
              {listLoading ? (
                <p className="sa-muted p-4 text-sm">Loading audit…</p>
              ) : (
                <ol className="sa-timeline relative ml-6 space-y-0 py-2">
                  {auditRows.map((row) => (
                    <li key={String(row.id)} className="relative py-3 pl-6 pr-4">
                      <span className="sa-timeline-dot absolute -left-[7px] top-5 h-3 w-3 rounded-full" />
                      <p className="sa-muted font-mono text-[11px]">{cell(row.time)}</p>
                      <p className="sa-ink font-bold [overflow-wrap:anywhere]">{cell(row.action)}</p>
                      <p className="sa-muted text-xs [overflow-wrap:anywhere]">
                        {cell(row.actor)} · {cell(row.resourceType)} · {cell(row.resourceId)}
                      </p>
                    </li>
                  ))}
                  {auditRows.length === 0 && <li className="sa-muted py-6 pl-6 text-sm">No audit entries.</li>}
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
                <>
                <select
                  value={listSort}
                  onChange={(e) => setListSort(e.target.value as ListSort)}
                  aria-label="Sort list"
                  data-testid="admin-list-sort"
                  className="sa-input px-3 py-2 text-sm"
                >
                  {LIST_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {tab === 'jobs' ||
                tab === 'applications' ||
                tab === 'interviews' ||
                tab === 'candidates' ||
                tab === 'employers' ||
                tab === 'admins' ? (
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by status"
                    className="sa-input px-3 py-2 text-sm"
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
                      ADMIN_INTERVIEW_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    {(tab === 'candidates' || tab === 'employers' || tab === 'admins') &&
                      ['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                  </select>
                ) : null}
                </>
              }
            />

            {tab === 'candidates' && <CandidateFilterBar value={candidateFilters} onApply={setCandidateFilters} />}

            {tab === 'applications' && <ApplicationPipelinePanel refreshKey={pipelineRefresh} />}

            {tab === 'skills' && canManageSkills(staffRole) && (
              <div className="sa-card p-4">
                <h3 className="sa-label mb-3 text-sm">Add skill</h3>
                <form onSubmit={onCreateSkill} className="grid gap-2 md:grid-cols-4">
                  <input
                    required
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Name"
                    className="sa-input px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={skillCategory}
                    onChange={(e) => setSkillCategory(e.target.value)}
                    placeholder="Category"
                    className="sa-input px-3 py-2 text-sm"
                  />
                  <input
                    value={skillAliases}
                    onChange={(e) => setSkillAliases(e.target.value)}
                    placeholder="Aliases"
                    className="sa-input px-3 py-2 text-sm"
                  />
                  <button type="submit" className="sa-btn">
                    Create skill
                  </button>
                </form>
              </div>
            )}

            {tab === 'admins' && canManageAdmins(staffRole) && (
              <div className="sa-dark rounded-[var(--sa-radius)] p-4">
                <h3 className="sa-on-dark-muted mb-3 text-sm font-bold uppercase tracking-wide">Create platform staff</h3>
                <form onSubmit={onCreateAdmin} className="grid gap-2 md:grid-cols-3">
                  <input
                    required
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Email"
                    className="sa-input sa-input--dark px-3 py-2 text-sm"
                  />
                  <input
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Full name"
                    className="sa-input sa-input--dark px-3 py-2 text-sm"
                  />
                  <input
                    required
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Password (visible to Super Admin)"
                    minLength={8}
                    autoComplete="new-password"
                    className="sa-input sa-input--dark px-3 py-2 text-sm"
                  />
                  <input
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="sa-input sa-input--dark px-3 py-2 text-sm"
                  />
                  <select
                    value={adminRole}
                    onChange={(e) =>
                      setAdminRole(e.target.value as 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'PLATFORM_OPERATOR')
                    }
                    className="sa-input sa-input--dark px-3 py-2 text-sm"
                  >
                    <option value="PLATFORM_OPERATOR">Platform operator</option>
                    <option value="PLATFORM_ADMIN">Platform admin</option>
                    <option value="SUPER_ADMIN">Super admin</option>
                  </select>
                  <button type="submit" className="sa-btn sa-btn--on-dark">
                    Create admin
                  </button>
                </form>
              </div>
            )}

            {listLoading && <p className="sa-muted text-sm">Loading {tab}…</p>}

            {!listLoading && rows.length === 0 && (
              <div className="sa-empty px-4 py-10 text-center text-sm">No records found.</div>
            )}

            {tab === 'candidates' && !listLoading && rows.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {sortedRows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.accountStatus ?? '');
                  const name = String(row.name ?? '—');
                  const skills = Array.isArray(row.primarySkills) ? row.primarySkills.map(String) : [];
                  const completion = Number(row.profileCompletion ?? 0);
                  return (
                    <article key={id} className="sa-ccard">
                      <div className="sa-ccard-h flex items-center gap-3 px-4 py-3">
                        <span className="sa-avatar flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold">{name}</p>
                          <p className="truncate text-xs opacity-90">{cell(row.email)}</p>
                        </div>
                      </div>
                      <div className="space-y-2 p-4 text-sm">
                        <p className="sa-ink">{cell(row.location)}</p>
                        <div className="sa-meter h-2 overflow-hidden">
                          <span style={{ width: `${Math.min(100, completion)}%` }} />
                        </div>
                        <p className="sa-muted text-[11px] font-semibold">Profile {completion}%</p>
                        <p className="sa-muted line-clamp-2 text-xs">
                          Skills: {skills.length ? skills.join(', ') : '—'}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <StatusPill status={status} />
                          <span className="sa-brand-text text-xs font-semibold">
                            {cell(row.applications)} apps · {cell(row.resumeCount)} resumes
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <ActionBtn onClick={() => void openDetail('candidates', id)}>View</ActionBtn>
                          <ActionBtn
                            disabled={!id || busyId === id || status === 'ACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminCandidateStatus(id, 'ACTIVE'), 'Candidate activated.')
                            }
                          >
                            Activate
                          </ActionBtn>
                          <ActionBtn
                            tone="secondary"
                            disabled={!id || busyId === id || status === 'INACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminCandidateStatus(id, 'INACTIVE'), 'Candidate deactivated.')
                            }
                          >
                            Deactivate
                          </ActionBtn>
                          <ActionBtn
                            tone="strong"
                            disabled={!id || busyId === id || status === 'SUSPENDED'}
                            onClick={() =>
                              void runAction(id, () => setAdminCandidateStatus(id, 'SUSPENDED'), 'Candidate suspended.')
                            }
                          >
                            Suspend
                          </ActionBtn>
                          {canOfferAccountDeletion({ viewerRole: staffRole, kind: 'candidates', status }) ? (
                            <ActionBtn
                              tone="danger"
                              disabled={!id || busyId === id}
                              onClick={() => setDeleteTarget({ kind: 'candidates', id, name })}
                            >
                              Delete
                            </ActionBtn>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'employers' && !listLoading && rows.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {sortedRows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.accountStatus ?? '');
                  const verified = Boolean(row.verified);
                  return (
                    <article key={id} className="sa-ccard flex">
                      <div className={`w-1.5 shrink-0 ${verified ? 'sa-strip--ok' : 'sa-strip--warn'}`} />
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="sa-ink font-bold [overflow-wrap:anywhere]">{cell(row.companyName)}</h3>
                            <p className="sa-muted text-xs [overflow-wrap:anywhere]">{cell(row.email)}</p>
                          </div>
                          <StatusPill status={status} />
                        </div>
                        <p className="sa-muted mt-2 text-xs">
                          {verified ? 'Verified employer' : 'Pending verification'} · {cell(row.jobs)} jobs
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <ActionBtn onClick={() => void openDetail('employers', id)}>View</ActionBtn>
                          <ActionBtn
                            disabled={!id || verified || busyId === id}
                            onClick={() => void runAction(id, () => verifyEmployer(id), 'Employer verified.')}
                          >
                            Verify
                          </ActionBtn>
                          <ActionBtn
                            disabled={!id || busyId === id || status === 'ACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminEmployerStatus(id, 'ACTIVE'), 'Employer activated.')
                            }
                          >
                            Activate
                          </ActionBtn>
                          <ActionBtn
                            tone="secondary"
                            disabled={!id || busyId === id || status === 'INACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setAdminEmployerStatus(id, 'INACTIVE'), 'Employer deactivated.')
                            }
                          >
                            Deactivate
                          </ActionBtn>
                          <ActionBtn
                            tone="strong"
                            disabled={!id || busyId === id || status === 'SUSPENDED'}
                            onClick={() =>
                              void runAction(id, () => setAdminEmployerStatus(id, 'SUSPENDED'), 'Employer suspended.')
                            }
                          >
                            Suspend
                          </ActionBtn>
                          {canOfferAccountDeletion({ viewerRole: staffRole, kind: 'employers', status }) ? (
                            <ActionBtn
                              tone="danger"
                              disabled={!id || busyId === id}
                              onClick={() =>
                                setDeleteTarget({ kind: 'employers', id, name: String(row.companyName ?? 'Employer') })
                              }
                            >
                              Delete
                            </ActionBtn>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'jobs' && !listLoading && rows.length > 0 && (
              <div className="space-y-2">
                {sortedRows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.status ?? '');
                  const bar =
                    status === 'PUBLISHED'
                      ? 'sa-strip--ok'
                      : status === 'PAUSED'
                        ? 'sa-strip--muted'
                        : status === 'PENDING_REVIEW'
                          ? 'sa-strip--info'
                          : status === 'CLOSED'
                          ? 'sa-strip--bad'
                          : 'sa-strip--warn';
                  return (
                    <article key={id} className="sa-ccard flex items-stretch">
                      <div className={`w-1.5 shrink-0 ${bar}`} />
                      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="sa-ink font-bold [overflow-wrap:anywhere]">{cell(row.title)}</p>
                          <p className="sa-muted text-xs">
                            {cell(row.companyName)} · {cell(row.city)} · {cell(row.applications)} apps
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={status} />
                          <ActionBtn onClick={() => void openDetail('jobs', id)}>
                            View
                          </ActionBtn>
                          {canManageJobs(staffRole) && status === 'PENDING_REVIEW' ? (
                            <>
                              <ActionBtn
                                disabled={!id || busyId === id}
                                onClick={() =>
                                  void runAction(id, () => approveAdminJob(id), 'Job approved and published.')
                                }
                              >
                                Approve
                              </ActionBtn>
                              <ActionBtn
                                tone="strong"
                                disabled={!id || busyId === id}
                                onClick={() =>
                                  void runAction(id, () => rejectAdminJob(id), 'Job rejected and returned to the employer.')
                                }
                              >
                                Reject
                              </ActionBtn>
                            </>
                          ) : null}
                          {canManageJobs(staffRole) && status !== 'PENDING_REVIEW' ? (
                            <>
                              <ActionBtn
                                disabled={!id || busyId === id || status === 'PUBLISHED'}
                                onClick={() =>
                                  void runAction(id, () => setAdminJobStatus(id, 'PUBLISHED'), 'Job published.')
                                }
                              >
                                Publish
                              </ActionBtn>
                              <ActionBtn
                                tone="secondary"
                                disabled={!id || busyId === id || status === 'PAUSED'}
                                onClick={() =>
                                  void runAction(id, () => setAdminJobStatus(id, 'PAUSED'), 'Job paused.')
                                }
                              >
                                Pause
                              </ActionBtn>
                              <ActionBtn
                                tone="strong"
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
                {sortedRows.map((row) => (
                  <article
                    key={String(row.id)}
                    className="sa-ccard relative border-l-4 border-l-[var(--sa-peri)] p-4"
                  >
                    <div className="sa-badge sa-badge--dark absolute right-0 top-0 rounded-none rounded-bl-[var(--sa-radius-sm)] px-2 py-1 text-[10px] uppercase">
                      {cell(row.status)}
                    </div>
                    <p className="sa-ink pr-24 font-bold [overflow-wrap:anywhere]">{cell(row.candidateName)}</p>
                    <p className="sa-ink mt-1 text-sm">{cell(row.jobTitle)}</p>
                    <p className="sa-muted text-xs">{cell(row.companyName)}</p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="sa-brand-text text-xs font-bold">Match {cell(row.matchScore)}</span>
                      <ActionBtn onClick={() => void openDetail('applications', String(row.id))}>View</ActionBtn>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {tab === 'interviews' && !listLoading && rows.length > 0 && (
              <div className="space-y-3">
                {sortedRows.map((row) => {
                  const shortlistedOnly = row.recordType === 'APPLICATION';
                  return (
                    <article
                      key={`${String(row.recordType ?? 'INTERVIEW')}-${String(row.id)}`}
                      className="sa-ccard grid gap-3 p-4 md:grid-cols-[140px_1fr_auto]"
                    >
                      <div className="sa-when px-3 py-3 text-center">
                        <p className="sa-on-dark-muted text-[10px] font-bold uppercase tracking-[0.12em]">Scheduled</p>
                        <p className="mt-1 text-xs font-bold leading-snug">
                          {shortlistedOnly ? 'Not scheduled yet' : cell(row.scheduledAt)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="sa-ink font-bold [overflow-wrap:anywhere]">{cell(row.candidateName)}</p>
                        <p className="sa-ink text-sm">{cell(row.jobTitle)}</p>
                        <p className="sa-muted text-xs">{cell(row.companyName)}</p>
                        <p className="sa-brand-text mt-1 text-[11px] font-bold">
                          {shortlistedOnly
                            ? 'Shortlisted · awaiting interview scheduling'
                            : `Mode ${cell(row.mode)} · WhatsApp ${adminWhatsAppStatusLabel(row.whatsappStatus) ?? '—'}`}
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-2">
                        <StatusPill
                          status={String(row.adminStatus ?? row.status ?? '')}
                          label={adminInterviewStatusLabel(row.adminStatus)}
                        />
                        <ActionBtn
                          onClick={() =>
                            void (shortlistedOnly
                              ? openDetail('applications', String(row.applicationId ?? row.id), {
                                  adminStatus: row.adminStatus,
                                })
                              : openDetail('interviews', String(row.id)))
                          }
                        >
                          View
                        </ActionBtn>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {tab === 'skills' && !listLoading && rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {sortedRows.map((row) => (
                    <span
                      key={`chip-${String(row.id)}`}
                      className={`sa-tag px-3 py-1 text-xs ${Boolean(row.active) ? '' : 'sa-tag--off'}`}
                    >
                      {cell(row.name)}
                    </span>
                  ))}
                </div>
                <div className="sa-card overflow-x-auto">
                  <table className="sa-table sa-table--brand min-w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2">Name</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Aliases</th>
                        <th className="px-3 py-2">Active</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row) => {
                        const id = String(row.id ?? '');
                        const active = Boolean(row.active);
                        return (
                          <tr key={id}>
                            <td className="px-3 py-2.5 font-semibold">{cell(row.name)}</td>
                            <td className="px-3 py-2.5">{cell(row.category)}</td>
                            <td className="sa-muted px-3 py-2.5">{cell(row.aliases)}</td>
                            <td className="px-3 py-2.5">
                              <StatusPill status={active ? 'ACTIVE' : 'INACTIVE'} />
                            </td>
                            <td className="px-3 py-2.5">
                              {canManageSkills(staffRole) ? (
                                <div className="flex flex-wrap gap-1.5">
                                  <ActionBtn
                                    tone="secondary"
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
                                    tone="secondary"
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
                                  {active && (
                                    <SkillMergeControl
                                      source={{ id, name: String(row.name ?? '') }}
                                      skills={rows.map((r) => ({
                                        id: String(r.id ?? ''),
                                        name: String(r.name ?? ''),
                                        active: Boolean(r.active),
                                      }))}
                                      onMerged={(message) => {
                                        setError('');
                                        setOk(message);
                                        void reloadList(appliedSearch);
                                      }}
                                      onError={(message) => {
                                        setOk('');
                                        setError(message);
                                      }}
                                    />
                                  )}
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
                {sortedRows.map((row) => {
                  const id = String(row.id ?? '');
                  const status = String(row.status ?? '');
                  const role = String(row.userType ?? '');
                  const password = row.password != null && String(row.password).length > 0 ? String(row.password) : null;
                  const canSuspend = superAdmin && role !== 'SUPER_ADMIN' && status !== 'SUSPENDED';
                  return (
                    <article key={id} className="sa-ccard p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="sa-ink font-bold [overflow-wrap:anywhere]">{cell(row.fullName) || cell(row.email)}</p>
                          <p className="sa-muted text-xs [overflow-wrap:anywhere]">{cell(row.email)}</p>
                        </div>
                        <span className="sa-badge sa-badge--dark shrink-0 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em]">
                          {role}
                        </span>
                      </div>
                      <div className="sa-inset mt-3 px-3 py-2">
                        <p className="sa-label">Login password</p>
                        <p className="sa-ink mt-0.5 font-mono text-sm [overflow-wrap:anywhere]">
                          {password || 'Not stored — set a new password'}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <StatusPill status={status} />
                        <span className="sa-muted text-[11px]">{cell(row.createdAt)}</span>
                      </div>
                      {superAdmin ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <ActionBtn
                            disabled={!id || busyId === id || status === 'ACTIVE'}
                            onClick={() =>
                              void runAction(id, () => setPlatformAdminStatus(id, 'ACTIVE'), 'Admin activated.')
                            }
                          >
                            Activate
                          </ActionBtn>
                          <ActionBtn
                            tone="secondary"
                            disabled={!id || busyId === id || status === 'INACTIVE' || role === 'SUPER_ADMIN'}
                            onClick={() =>
                              void runAction(id, () => setPlatformAdminStatus(id, 'INACTIVE'), 'Admin deactivated.')
                            }
                          >
                            Deactivate
                          </ActionBtn>
                          <ActionBtn
                            tone="strong"
                            disabled={!canSuspend || busyId === id}
                            onClick={() =>
                              void runAction(id, () => setPlatformAdminStatus(id, 'SUSPENDED'), 'Admin suspended.')
                            }
                          >
                            Suspend
                          </ActionBtn>
                          <ActionBtn
                            tone="secondary"
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
                            tone="secondary"
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
                          {canOfferAccountDeletion({ viewerRole: staffRole, kind: 'admins', status, targetRole: role }) ? (
                            <ActionBtn
                              tone="danger"
                              disabled={!id || busyId === id}
                              onClick={() =>
                                setDeleteTarget({ kind: 'admins', id, name: String(row.fullName || row.email || 'Admin') })
                              }
                            >
                              Delete
                            </ActionBtn>
                          ) : null}
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
      <AccountDeleteDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={onAccountDeleted} />
    </SuperAdminShell>
  );
}
