'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminDashboard, PlatformAdminRecord } from '@careerbridge/shared';
import {
  isAdminStaffType,
  isPlatformUserType,
  isSuperAdminType,
  platformPasswordError,
} from '@careerbridge/shared';
import {
  adminCreateCity,
  adminCreateState,
  adminDeleteCity,
  adminDeleteState,
  adminListCities,
  adminListStates,
  adminUpdateCity,
  adminUpdateState,
  createPlatformAdmin,
  getAdminDashboard,
  listPlatformAdmins,
  logout,
  suspendPlatformAdmin,
} from '@/lib/api';
import { getStoredUser } from '@/lib/session';
import { Logo } from '@/components/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type StateRow = {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  _count: { cities: number };
};

type CityRow = {
  id: string;
  name: string;
  active: boolean;
  stateId: string;
  state: { id: string; name: string; code: string | null };
};

export default function AdminPage() {
  const router = useRouter();
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminDashboard | null>(null);
  const [ready, setReady] = useState(false);

  const superAdmin = isSuperAdminType(actorRole);
  const staffAdmin = isAdminStaffType(actorRole);

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored || !isPlatformUserType(stored.role)) {
      router.replace('/login');
      return;
    }
    setActorRole(stored.role);
    getAdminDashboard()
      .then(setMetrics)
      .catch(() => router.replace('/login'))
      .finally(() => setReady(true));
  }, [router]);

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  if (!ready || !actorRole) {
    return (
      <main className="cb-ops">
        <p className="cb-ops-muted">Loading console…</p>
      </main>
    );
  }

  return (
    <main className="cb-ops">
      <header className="cb-ops-top">
        <div>
          <Logo />
          <p className="cb-ops-kicker">{superAdmin ? 'Super Admin' : 'Admin'} console</p>
          <h1>{superAdmin ? 'Admin accounts' : 'Locations'}</h1>
          <p className="cb-ops-lead">
            {superAdmin
              ? 'Create and manage Admin users only. Location data is managed by Admins.'
              : 'Maintain states and cities used in candidate registration.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>

      {superAdmin ? (
        <SuperAdminPanel metrics={metrics} />
      ) : staffAdmin ? (
        <AdminLocationsPanel metrics={metrics} />
      ) : (
        <p className="cb-ops-alert">This account cannot access the console.</p>
      )}
    </main>
  );
}

function SuperAdminPanel({ metrics }: { metrics: AdminDashboard | null }) {
  const [admins, setAdmins] = useState<PlatformAdminRecord[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState('');
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setAdmins(await listPlatformAdmins());
  }

  useEffect(() => {
    void refresh().catch(() => setAdmins([]));
  }, []);

  async function onCreateAdmin(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setFormOk('');
    const pwdError = platformPasswordError(password);
    if (pwdError) {
      setFormError(pwdError);
      return;
    }
    setSaving(true);
    try {
      await createPlatformAdmin({ email: email.trim(), fullName: fullName.trim(), password });
      setFormOk('Admin created. They sign in from the Admin tab.');
      setEmail('');
      setFullName('');
      setPassword('');
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create admin.');
    } finally {
      setSaving(false);
    }
  }

  async function onSuspend(id: string) {
    try {
      await suspendPlatformAdmin(id);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not suspend admin.');
    }
  }

  return (
    <div className="cb-ops-grid">
      <section className="cb-ops-metrics">
        <article>
          <span>Admins</span>
          <strong>{metrics?.admins ?? admins.filter((a) => a.userType !== 'SUPER_ADMIN').length}</strong>
        </article>
        <article>
          <span>Candidates</span>
          <strong>{metrics?.candidates ?? '—'}</strong>
        </article>
        <article>
          <span>Employers</span>
          <strong>{metrics?.employers ?? '—'}</strong>
        </article>
      </section>

      <section className="cb-ops-card">
        <h2>Register Admin</h2>
        <p className="cb-ops-muted">Password is stored as a strong one-way hash.</p>
        <form onSubmit={onCreateAdmin} className="cb-ops-form">
          <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            hint="12+ characters, upper, lower, and a number"
          />
          {formError ? <p className="cb-ops-alert">{formError}</p> : null}
          {formOk ? <p className="cb-ops-ok">{formOk}</p> : null}
          <Button type="submit" loading={saving} loadingLabel="Creating…">
            Create Admin
          </Button>
        </form>
      </section>

      <section className="cb-ops-card cb-ops-wide">
        <h2>Platform accounts</h2>
        <div className="cb-ops-table-wrap">
          <table className="cb-ops-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {admins.map((row) => (
                <tr key={row.id}>
                  <td>{row.email}</td>
                  <td>
                    <span className="cb-ops-pill">{row.userType.replaceAll('_', ' ')}</span>
                  </td>
                  <td>{row.status}</td>
                  <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString('en-IN') : '—'}</td>
                  <td>
                    {row.userType !== 'SUPER_ADMIN' && row.status === 'ACTIVE' ? (
                      <button type="button" className="cb-ops-link-danger" onClick={() => void onSuspend(row.id)}>
                        Suspend
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AdminLocationsPanel({ metrics }: { metrics: AdminDashboard | null }) {
  const [tab, setTab] = useState<'states' | 'cities'>('states');
  const [states, setStates] = useState<StateRow[]>([]);
  const [cities, setCities] = useState<CityRow[]>([]);
  const [stateName, setStateName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [cityName, setCityName] = useState('');
  const [cityStateId, setCityStateId] = useState('');
  const [filterStateId, setFilterStateId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const activeStates = useMemo(() => states.filter((s) => s.active), [states]);

  async function refreshStates() {
    setStates(await adminListStates());
  }
  async function refreshCities(stateId?: string) {
    setCities(await adminListCities(stateId || undefined));
  }

  useEffect(() => {
    void refreshStates().catch(() => setStates([]));
  }, []);

  useEffect(() => {
    void refreshCities(filterStateId || undefined).catch(() => setCities([]));
  }, [filterStateId]);

  async function onCreateState(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await adminCreateState({ name: stateName.trim(), code: stateCode.trim() || undefined });
      setStateName('');
      setStateCode('');
      setMessage('State added.');
      await refreshStates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add state.');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateCity(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!cityStateId) {
      setError('Select a state for this city.');
      return;
    }
    setBusy(true);
    try {
      await adminCreateCity({ stateId: cityStateId, name: cityName.trim() });
      setCityName('');
      setMessage('City added.');
      await refreshCities(filterStateId || undefined);
      await refreshStates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add city.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cb-ops-grid">
      <section className="cb-ops-metrics">
        <article>
          <span>States</span>
          <strong>{metrics?.states ?? states.length}</strong>
        </article>
        <article>
          <span>Cities</span>
          <strong>{metrics?.cities ?? cities.length}</strong>
        </article>
        <article>
          <span>Candidates</span>
          <strong>{metrics?.candidates ?? '—'}</strong>
        </article>
      </section>

      <div className="cb-ops-tabs">
        <button type="button" className={tab === 'states' ? 'is-on' : ''} onClick={() => setTab('states')}>
          States
        </button>
        <button type="button" className={tab === 'cities' ? 'is-on' : ''} onClick={() => setTab('cities')}>
          Cities
        </button>
      </div>

      {error ? <p className="cb-ops-alert">{error}</p> : null}
      {message ? <p className="cb-ops-ok">{message}</p> : null}

      {tab === 'states' ? (
        <>
          <section className="cb-ops-card">
            <h2>Add state</h2>
            <form onSubmit={onCreateState} className="cb-ops-form">
              <Input label="State name" value={stateName} onChange={(e) => setStateName(e.target.value)} required />
              <Input label="Code (optional)" value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="TN" />
              <Button type="submit" loading={busy} loadingLabel="Saving…">
                Add state
              </Button>
            </form>
          </section>
          <section className="cb-ops-card cb-ops-wide">
            <h2>All states</h2>
            <div className="cb-ops-table-wrap">
              <table className="cb-ops-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Cities</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {states.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.code || '—'}</td>
                      <td>{row._count.cities}</td>
                      <td>{row.active ? 'Active' : 'Hidden'}</td>
                      <td className="cb-ops-actions">
                        <button
                          type="button"
                          className="cb-ops-link"
                          onClick={() =>
                            void adminUpdateState(row.id, { active: !row.active }).then(refreshStates)
                          }
                        >
                          {row.active ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          className="cb-ops-link-danger"
                          onClick={() =>
                            void adminDeleteState(row.id)
                              .then(refreshStates)
                              .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'))
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="cb-ops-card">
            <h2>Add city</h2>
            <form onSubmit={onCreateCity} className="cb-ops-form">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-primary">State</span>
                <select
                  required
                  value={cityStateId}
                  onChange={(e) => setCityStateId(e.target.value)}
                  className="w-full rounded-md border border-primary/10 bg-[#faf8f3] px-3.5 py-3.5 text-base"
                >
                  <option value="">Select state</option>
                  {activeStates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="City name" value={cityName} onChange={(e) => setCityName(e.target.value)} required />
              <Button type="submit" loading={busy} loadingLabel="Saving…">
                Add city
              </Button>
            </form>
          </section>
          <section className="cb-ops-card cb-ops-wide">
            <div className="cb-ops-toolbar">
              <h2>All cities</h2>
              <select
                value={filterStateId}
                onChange={(e) => setFilterStateId(e.target.value)}
                className="rounded-md border border-primary/10 bg-white px-3 py-2 text-sm"
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="cb-ops-table-wrap">
              <table className="cb-ops-table">
                <thead>
                  <tr>
                    <th>City</th>
                    <th>State</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cities.map((row) => (
                    <tr key={row.id}>
                      <td>{row.name}</td>
                      <td>{row.state.name}</td>
                      <td>{row.active ? 'Active' : 'Hidden'}</td>
                      <td className="cb-ops-actions">
                        <button
                          type="button"
                          className="cb-ops-link"
                          onClick={() =>
                            void adminUpdateCity(row.id, { active: !row.active }).then(() =>
                              refreshCities(filterStateId || undefined),
                            )
                          }
                        >
                          {row.active ? 'Hide' : 'Show'}
                        </button>
                        <button
                          type="button"
                          className="cb-ops-link-danger"
                          onClick={() =>
                            void adminDeleteCity(row.id)
                              .then(() => refreshCities(filterStateId || undefined))
                              .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'))
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
