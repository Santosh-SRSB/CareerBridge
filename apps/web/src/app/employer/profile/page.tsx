'use client';

import { toast } from '@/components/ui/Toast';
import { userFacingError } from '@/lib/client-errors';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { EmployerProfile } from '@careerbridge/shared';
import {
  COMPANY_ABOUT_MAX,
  COMPANY_INDUSTRIES,
  COMPANY_SIZES,
  COMPANY_SIZE_LABELS,
  parseLinkedinUrl,
  personNameError,
  photoFileError,
} from '@careerbridge/shared';
import { getEmployerMe, updateEmployerMe, uploadEmployerLogo, listEmployerJobs } from '@/lib/api';
import { EmployerShell, EmployerShellFallback, statusLabel } from '@/components/EmployerPortal';
import { CitySelect } from '@/components/ui/CitySelect';
import { EvAlert, EvEmpty, EvPageHead, EvPageSkeleton, EvPill } from '@/components/employer/ui';
import { getStoredUser } from '@/lib/session';
import Link from 'next/link';
import { FormEvent, useMemo } from 'react';

type FieldErrors = Partial<
  Record<'companyName' | 'industry' | 'companySize' | 'city' | 'contactName' | 'website' | 'linkedinUrl', string>
>;

function websiteError(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const message = 'Enter a valid website starting with http:// or https://.';
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):(?!\d)/i)?.[1]?.toLowerCase();
  if (/\s/.test(value) || (scheme && scheme !== 'http' && scheme !== 'https')) return message;
  try {
    const url = new URL(scheme ? value : `https://${value}`);
    return url.hostname.includes('.') && !url.username && !url.password ? undefined : message;
  } catch {
    return message;
  }
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span>
      {label}
      {required ? (
        <em className="ev-req" aria-hidden>
          {' '}
          *
        </em>
      ) : (
        <span className="ev-opt"> (optional)</span>
      )}
    </span>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <em id={`${id}-error`} className="ev-error" role="alert">
      {error}
    </em>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder,
  required,
  error,
  type = 'text',
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  type?: string;
}) {
  return (
    <label htmlFor={name}>
      <FieldLabel label={label} required={required} />
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={name} error={error} />
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
    <article className="ev-card">
      <h2 className="ev-h2">{monthLabel}</h2>
      <div className="ev-cal ev-cal--week" aria-hidden>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span key={`${d}-${i}`}>{d}</span>
        ))}
      </div>
      <div className="ev-cal">
        {cells.map((day, i) => (
          <span key={`${day}-${i}`} className={day === today.getDate() ? 'is-today' : undefined}>
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
  const [logoBusy, setLogoBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [events, setEvents] = useState<Array<{ title: string; meta: string; href: string }>>([]);
  const logoInputRef = useRef<HTMLInputElement>(null);
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

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (profile.companyName.trim().length < 2) next.companyName = 'Company name is required.';
    if (!(profile.industry || '').trim()) next.industry = 'Please select an industry.';
    if (!(profile.companySize || '').trim()) next.companySize = 'Please select company size.';
    if ((profile.city || '').trim().length < 2) next.city = 'Please select a location.';
    const contactError = personNameError(profile.contactName || '', 'Enter the contact person name.');
    if (contactError) next.contactName = contactError;
    const siteError = websiteError(profile.website || '');
    if (siteError) next.website = siteError;
    const linkedin = parseLinkedinUrl(profile.linkedinUrl || '');
    if (!linkedin.ok) next.linkedinUrl = linkedin.message;
    return next;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setFieldErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      setError('Please fix the highlighted fields.');
      setMessage('');
      document.getElementById(first === 'city' ? 'company-city' : first)?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updated = await updateEmployerMe({
        companyName: profile.companyName,
        industry: profile.industry ?? undefined,
        city: profile.city ?? undefined,
        contactName: profile.contactName ?? undefined,
        designation: profile.designation ?? undefined,
        workEmail: profile.workEmail ?? undefined,
        website: profile.website ?? undefined,
        companySize: profile.companySize ?? undefined,
        about: profile.about ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
      });
      setProfile(updated);
      setMessage('');
      toast.success('Company profile saved successfully');
    } catch (err) {
      const text = userFacingError(err, 'save profile');
      setError(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  }

  async function onLogoSelected(file: File | null) {
    if (!file) return;
    const invalid = photoFileError(file.type, file.size);
    if (invalid) {
      setError(invalid);
      setMessage('');
      return;
    }
    setLogoBusy(true);
    setError('');
    setMessage('');
    try {
      const updated = await uploadEmployerLogo(file, file.name || 'logo.jpg');
      setProfile(updated);
      setMessage('Company logo updated.');
    } catch (err) {
      setError(userFacingError(err, 'update the company logo'));
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  const logoPreview = profile.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.logoUrl} alt="" />
  ) : (
    <span>{(profile.companyName || 'C').slice(0, 1).toUpperCase()}</span>
  );

  if (!settingsTab) {
    return (
      <>
        <EvPageHead
          eyebrow="Company"
          title="Hiring workspace"
          subtitle={`${profile.companyName}${profile.city ? ` · ${profile.city}` : ''}`}
          actions={
            <Link href="/employer/profile" className="ev-btn ev-btn--ghost">
              ← Company Profile
            </Link>
          }
        />

        <div className="ev-grid ev-g3 ev-mt">
          <article className="ev-card ev-ident">
            <div className="ev-logo" aria-hidden>
              {profile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.logoUrl} alt="" />
              ) : (
                <span>{contact.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="ev-ident-name">
              <h2 className="ev-h2">{contact}</h2>
              <EvPill tone={status === 'VERIFIED' ? 'green' : 'amber'}>{badge}</EvPill>
            </div>
            <p className="ev-sub">
              {profile.designation || 'Hiring manager'}
              {profile.industry ? ` · ${profile.industry}` : ''}
            </p>
            <ul className="ev-plain-list ev-ident-meta">
              <li>{email}</li>
              <li>{phone}</li>
              <li>{profile.companyName}</li>
              <li>{profile.city || 'Location not set'}</li>
            </ul>
          </article>

          <MiniCalendar />

          <article className="ev-card">
            <div className="ev-card-head">
              <h2 className="ev-h2">Upcoming activity</h2>
              <Link href="/employer/jobs" className="ev-lnk">
                View all
              </Link>
            </div>
            {events.length === 0 ? (
              <EvEmpty
                title="No live roles yet"
                action={
                  <Link href="/employer/jobs/new" className="ev-btn ev-mt-sm">
                    Post a job
                  </Link>
                }
              />
            ) : (
              <ul className="ev-plain-list ev-linkrows">
                {events.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>
                      {item.title}
                      <small>{item.meta}</small>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>

        <div className="ev-grid ev-g2 ev-mt">
          <article className="ev-card">
            <h2 className="ev-h2">Company information</h2>
            <div className="ev-kvl">
              <div>
                <small>Status</small>
                <b>{badge}</b>
              </div>
              <div>
                <small>Industry</small>
                <b>{profile.industry || '—'}</b>
              </div>
              <div>
                <small>City</small>
                <b>{profile.city || '—'}</b>
              </div>
              <div>
                <small>GST</small>
                <b>{profile.gstNumber || 'Not added'}</b>
              </div>
            </div>
            <ul className="ev-plain-list ev-iconrow">
              <li>
                <span aria-hidden>🏢</span>
                Employer
              </li>
              <li>
                <span aria-hidden>📍</span>
                {profile.city || 'City'}
              </li>
              <li>
                <span aria-hidden>✓</span>
                {status === 'VERIFIED' ? 'Verified' : 'Verify'}
              </li>
              <li>
                <span aria-hidden>✉</span>
                Contact
              </li>
            </ul>
          </article>

          <article className="ev-card">
            <div className="ev-card-head">
              <h2 className="ev-h2">Onboarding</h2>
              <span className="ev-pill">
                {doneCount}/{onboarding.length} completed
              </span>
            </div>
            <ul className="ev-plain-list ev-checklist">
              {onboarding.map((step) => (
                <li key={step.id} className={step.done ? 'is-done' : undefined}>
                  <span className="ev-check" aria-hidden>
                    {step.done ? '✓' : ''}
                  </span>
                  <span>{step.label}</span>
                  <Link href={step.href} className="ev-lnk">
                    {step.done ? 'View' : 'Start'}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/employer/jobs/new" className="ev-btn ev-mt-sm">
              Add new job
            </Link>
          </article>
        </div>
      </>
    );
  }

  return (
    <>
      <EvPageHead
        eyebrow="Company"
        title="Company Profile"
        subtitle="Logo, company details, and website for your hiring workspace."
        actions={
          <>
            <span className="ev-logo ev-logo--sm" aria-hidden>
              {logoPreview}
            </span>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => void onLogoSelected(event.target.files?.[0] || null)}
            />
            <button
              type="button"
              className="ev-btn"
              disabled={logoBusy}
              onClick={() => logoInputRef.current?.click()}
            >
              {logoBusy ? 'Uploading…' : profile.logoUrl ? 'Change logo' : 'Logo'}
            </button>
            <Link href="/employer/profile?tab=desk" className="ev-btn ev-btn--ghost">
              View workspace →
            </Link>
          </>
        }
      />

      <form onSubmit={onSubmit} noValidate className="ev-card ev-form ev-mt">
        <div className="ev-f">
          <Field
            label="Company name"
            name="companyName"
            value={profile.companyName}
            placeholder="Your company name"
            required
            error={fieldErrors.companyName}
            onChange={(companyName) => setProfile({ ...profile, companyName })}
          />
          <label htmlFor="industry">
            <FieldLabel label="Industry" required />
            <select
              id="industry"
              value={profile.industry || ''}
              required
              aria-required
              aria-invalid={fieldErrors.industry ? true : undefined}
              aria-describedby={fieldErrors.industry ? 'industry-error' : undefined}
              onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
            >
              <option value="">Select industry</option>
              {profile.industry && !(COMPANY_INDUSTRIES as readonly string[]).includes(profile.industry) ? (
                <option value={profile.industry}>{profile.industry}</option>
              ) : null}
              {COMPANY_INDUSTRIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <FieldError id="industry" error={fieldErrors.industry} />
          </label>
          <label htmlFor="companySize">
            <FieldLabel label="Company size" required />
            <select
              id="companySize"
              value={profile.companySize || ''}
              required
              aria-required
              aria-invalid={fieldErrors.companySize ? true : undefined}
              aria-describedby={fieldErrors.companySize ? 'companySize-error' : undefined}
              onChange={(e) => setProfile({ ...profile, companySize: e.target.value })}
            >
              <option value="">Select company size</option>
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {COMPANY_SIZE_LABELS[size]}
                </option>
              ))}
            </select>
            <FieldError id="companySize" error={fieldErrors.companySize} />
          </label>
          <div>
            <CitySelect
              id="company-city"
              label="Location *"
              value={profile.city || ''}
              onChange={(city) => setProfile({ ...profile, city })}
            />
            <FieldError id="company-city" error={fieldErrors.city} />
          </div>
          <label htmlFor="about" className="ev-span">
            <FieldLabel label="About the company" />
            <textarea
              id="about"
              rows={4}
              maxLength={COMPANY_ABOUT_MAX}
              value={profile.about || ''}
              placeholder="What does your company do? What is it like to work there?"
              aria-describedby="about-count"
              onChange={(e) => setProfile({ ...profile, about: e.target.value.slice(0, COMPANY_ABOUT_MAX) })}
            />
            <em id="about-count" className="ev-count" aria-live="polite">
              {(profile.about || '').length}/{COMPANY_ABOUT_MAX}
            </em>
          </label>
          <Field
            label="Contact person"
            name="contactName"
            value={profile.contactName || ''}
            placeholder="Primary hiring contact"
            required
            error={fieldErrors.contactName}
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
            type="url"
            error={fieldErrors.website}
            onChange={(website) => setProfile({ ...profile, website })}
          />
          <Field
            label="LinkedIn URL"
            name="linkedinUrl"
            value={profile.linkedinUrl || ''}
            placeholder="https://www.linkedin.com/company/your-company"
            type="url"
            error={fieldErrors.linkedinUrl}
            onChange={(linkedinUrl) => setProfile({ ...profile, linkedinUrl })}
          />
        </div>
        {error || message ? (
          <div className="ev-mt">
            {error ? <EvAlert tone="error">{error}</EvAlert> : null}
            {message ? <EvAlert tone="ok">{message}</EvAlert> : null}
          </div>
        ) : null}
        <div className="ev-form-actions ev-form-actions--split">
          <p className="ev-sub">Changes apply immediately after you save.</p>
          <button type="submit" className="ev-btn ev-btn--amber" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </>
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
        {error ? <EvAlert tone="error">{error}</EvAlert> : <EvPageSkeleton />}
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
          <EvPageSkeleton />
        </EmployerShellFallback>
      }
    >
      <ProfilePageBody />
    </Suspense>
  );
}
