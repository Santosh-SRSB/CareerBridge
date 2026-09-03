'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EmployerProfile } from '@careerbridge/shared';
import { personNameError } from '@careerbridge/shared';
import { getEmployerMe, updateEmployerMe, listEmployerJobs } from '@/lib/api';
import { EmployerShell, EmployerShellFallback, statusLabel } from '@/components/EmployerPortal';
import { CitySelect } from '@/components/ui/CitySelect';
import { Button } from '@/components/ui/Button';
import { getStoredUser } from '@/lib/session';
import Link from 'next/link';
import { FormEvent, useMemo } from 'react';

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="ep-field" htmlFor={name}>
      <span>{label}</span>
      <input
        id={name}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function MiniCalendar() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const monthLabel = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <article className="ep-card ep-cal">
      <div className="ep-card__head">
        <h2>{monthLabel}</h2>
      </div>
      <div className="ep-cal__week">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="ep-cal__grid">
        {cells.map((day, i) => (
          <span key={`${day}-${i}`} className={day === today.getDate() ? 'is-today' : ''}>
            {day || ''}
          </span>
        ))}
      </div>
    </article>
  );
}

function ProfileDesk({ profile: initial }: { profile: EmployerProfile }) {
  const params = useSearchParams();
  const settingsTab = params.get('tab') !== 'desk';
  const [profile, setProfile] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [events, setEvents] = useState<Array<{ title: string; meta: string; href: string }>>([]);
  const user = getStoredUser();

  useEffect(() => {
    setProfile(initial);
  }, [initial]);

  useEffect(() => {
    listEmployerJobs()
      .then((jobs) => {
        setEvents(
          jobs.slice(0, 3).map((job) => ({
            title: job.title,
            meta: `${job.status === 'PUBLISHED' ? 'Live role' : job.status} · ${job.city || 'India'}`,
            href: `/employer/jobs/${job.id}`,
          })),
        );
      })
      .catch(() => undefined);
  }, []);

  const status = profile.verificationStatus || 'PENDING';
  const badge = statusLabel(status);
  const contact = profile.contactName || user?.firstName || 'Hiring contact';
  const email = profile.workEmail || '—';
  const phone = user?.phone || '—';

  const onboarding = useMemo(() => {
    return [
      {
        id: 'company',
        label: 'Complete company profile',
        done: Boolean(profile.companyName && profile.city && profile.contactName),
        href: '/employer/profile?tab=settings',
      },
      {
        id: 'kyc',
        label: 'Finish KYC / verification',
        done: status === 'VERIFIED' || status === 'PENDING' || status === 'KYC_COMPLETE',
        href: '/employer/kyc',
      },
      {
        id: 'job',
        label: 'Post your first job',
        done: events.length > 0,
        href: '/employer/jobs/new',
      },
      {
        id: 'review',
        label: 'Review applications',
        done: false,
        href: '/employer/applications',
      },
    ];
  }, [profile, status, events.length]);

  const doneCount = onboarding.filter((s) => s.done).length;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (profile.companyName.trim().length < 2) {
      setError('Enter the company name.');
      setMessage('');
      return;
    }
    if ((profile.city || '').trim().length < 2) {
      setError('Select or enter the company location.');
      setMessage('');
      return;
    }
    const contactError = personNameError(profile.contactName || '', 'Enter the contact person name.');
    if (contactError) {
      setError(contactError);
      setMessage('');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateEmployerMe(profile);
      setProfile(updated);
      setMessage('Company profile saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not save the company profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ep-desk">
      <div className="ep-desk__title-row">
        <Link href={settingsTab ? '/employer/profile?tab=desk' : '/employer/profile'} className="ep-link">
          {settingsTab ? 'View workspace →' : '← Company Profile'}
        </Link>
      </div>

      {!settingsTab ? (
        <>
          <div className="ep-desk__top">
            <article className="ep-card ep-identity">
              <div className="ep-identity__photo" aria-hidden>
                {contact.slice(0, 1).toUpperCase()}
              </div>
              <div className="ep-identity__body">
                <div className="ep-identity__name">
                  <h2>{contact}</h2>
                  <span className="ep-pill">{badge}</span>
                </div>
                <p className="ep-identity__role">
                  {profile.designation || 'Hiring manager'}
                  {profile.industry ? ` · ${profile.industry}` : ''}
                </p>
                <ul className="ep-identity__meta">
                  <li>{email}</li>
                  <li>{phone}</li>
                  <li>{profile.companyName}</li>
                  <li>{profile.city || 'Location not set'}</li>
                </ul>
              </div>
            </article>

            <MiniCalendar />

            <article className="ep-card ep-events">
              <div className="ep-card__head">
                <h2>Upcoming activity</h2>
                <Link href="/employer/jobs">View all</Link>
              </div>
              {events.length === 0 ? (
                <div className="ep-empty">
                  <p>No live roles yet</p>
                  <Link href="/employer/jobs/new" className="ep-btn-gold">
                    Post a job
                  </Link>
                </div>
              ) : (
                <ul className="ep-events__list">
                  {events.map((item, index) => (
                    <li key={item.href} className={index === 0 ? 'is-hot' : ''}>
                      <Link href={item.href}>
                        <strong>{item.title}</strong>
                        <span>{item.meta}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <div className="ep-desk__bottom">
            <article className="ep-card ep-info">
              <h2>Company information</h2>
              <div className="ep-info__chips">
                <div>
                  <span>Status</span>
                  <strong>{badge}</strong>
                </div>
                <div>
                  <span>Industry</span>
                  <strong>{profile.industry || '—'}</strong>
                </div>
                <div>
                  <span>City</span>
                  <strong>{profile.city || '—'}</strong>
                </div>
                <div>
                  <span>GST</span>
                  <strong>{profile.gstNumber || 'Not added'}</strong>
                </div>
              </div>
              <div className="ep-info__icons">
                <div>
                  <span>🏢</span>
                  <p>Employer</p>
                </div>
                <div>
                  <span>📍</span>
                  <p>{profile.city || 'City'}</p>
                </div>
                <div>
                  <span>✓</span>
                  <p>{status === 'VERIFIED' ? 'Verified' : 'Verify'}</p>
                </div>
                <div>
                  <span>✉</span>
                  <p>Contact</p>
                </div>
              </div>
            </article>

            <article className="ep-card ep-onboard">
              <div className="ep-card__head">
                <h2>Onboarding</h2>
                <span>
                  {doneCount}/{onboarding.length} completed
                </span>
              </div>
              <ul className="ep-onboard__list">
                {onboarding.map((step) => (
                  <li key={step.id} className={step.done ? 'is-done' : ''}>
                    <span className="ep-onboard__check" aria-hidden>
                      {step.done ? '✓' : ''}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p>{step.label}</p>
                    </div>
                    <Link href={step.href}>{step.done ? 'View' : 'Start'}</Link>
                  </li>
                ))}
              </ul>
              <Link href="/employer/jobs/new" className="ep-btn-gold ep-onboard__cta">
                Add new job
              </Link>
            </article>
          </div>
        </>
      ) : (
        <article className="ep-card ep-settings">
          <form onSubmit={onSubmit} className="ep-settings__form">
            <div className="ep-card__head">
              <div>
                <h2>Company Profile</h2>
                <p>E03 — Logo, company details, and website for your hiring workspace.</p>
              </div>
              <button type="button" className="ep-btn-gold text-sm font-extrabold">
                Logo
              </button>
            </div>
            <div className="ep-settings__grid">
              <Field
                label="Company name"
                name="companyName"
                value={profile.companyName}
                placeholder="Your company name"
                onChange={(companyName) => setProfile({ ...profile, companyName })}
              />
              <Field
                label="Industry"
                name="industry"
                value={profile.industry || ''}
                placeholder="e.g. Customer Service"
                onChange={(industry) => setProfile({ ...profile, industry })}
              />
              <div className="ep-field ep-field--full">
                <CitySelect
                  label="Location"
                  value={profile.city || ''}
                  onChange={(city) => setProfile({ ...profile, city })}
                />
              </div>
              <Field
                label="Contact person"
                name="contactName"
                value={profile.contactName || ''}
                placeholder="Primary hiring contact"
                onChange={(contactName) => setProfile({ ...profile, contactName })}
              />
              <Field
                label="Designation"
                name="designation"
                value={profile.designation || ''}
                placeholder="e.g. HR Manager"
                onChange={(designation) => setProfile({ ...profile, designation })}
              />
              <Field
                label="Work email"
                name="workEmail"
                value={profile.workEmail || ''}
                placeholder="hr@company.com"
                onChange={(workEmail) => setProfile({ ...profile, workEmail })}
              />
              <Field
                label="Website"
                name="website"
                value={profile.website || ''}
                placeholder="https://company.com"
                onChange={(website) => setProfile({ ...profile, website })}
              />
            </div>
            {error ? <p className="ep-alert ep-alert--error">{error}</p> : null}
            {message ? <p className="ep-alert ep-alert--ok">{message}</p> : null}
            <div className="ep-settings__foot">
              <p>Changes apply immediately after you save.</p>
              <Button
                type="submit"
                loading={saving}
                loadingLabel="Saving..."
                block={false}
                className="ep-btn-save"
              >
                Save profile
              </Button>
            </div>
          </form>
        </article>
      )}
    </div>
  );
}

function ProfilePageBody() {
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getEmployerMe().then(setProfile).catch(() => setError('Could not load company profile.'));
  }, []);

  if (!profile) {
    return (
      <EmployerShellFallback title="Profile">
        <p className="ep-loading">{error || 'Loading company profile…'}</p>
      </EmployerShellFallback>
    );
  }

  return (
    <EmployerShell profile={profile} title="Profile">
      <ProfileDesk profile={profile} />
    </EmployerShell>
  );
}

export default function EmployerProfilePage() {
  return (
    <Suspense
      fallback={
        <EmployerShellFallback title="Profile">
          <p className="ep-loading">Loading company profile…</p>
        </EmployerShellFallback>
      }
    >
      <ProfilePageBody />
    </Suspense>
  );
}
