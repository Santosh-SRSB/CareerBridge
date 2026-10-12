'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { SUPPORT_FAQS, type FaqItem } from '@/data/support-faqs';
import { SUPPORT_EMAIL } from '@/lib/social-links';

type FaqTab = 'candidate' | 'employer' | 'general';

const TAB_LABELS: Record<FaqTab, string> = {
  candidate: 'Candidate FAQ',
  employer: 'Employer FAQ',
  general: 'General FAQ',
};

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]';
const focusRingOnNavy =
  'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white';
const navLinkClass = `rounded-sm border-b-2 border-transparent py-1 text-white/85 no-underline transition-colors hover:border-white hover:text-white ${focusRingOnNavy}`;
const buttonBase = `inline-flex h-12 items-center justify-center whitespace-nowrap rounded-xl border-[1.5px] border-[var(--color-primary)] px-6 text-sm font-semibold no-underline transition-colors ${focusRing}`;
const primaryButton = `${buttonBase} bg-[var(--color-primary)] text-white hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:border-[var(--color-primary-soft)] disabled:bg-[var(--color-primary-soft)] disabled:text-[var(--color-primary-dark)]`;
const secondaryButton = `${buttonBase} bg-white text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]`;
const fieldLabel = 'block text-[13px] font-semibold text-[var(--color-text-primary)]';
// --support-field-border must stay at 3:1 or more against both the white card and the field fill (WCAG 1.4.11).
const fieldControl =
  'mt-1.5 w-full rounded-lg border border-[var(--support-field-border)] bg-[var(--color-background)] px-3 py-2.5 text-sm font-normal text-[var(--color-text-primary)] transition-colors focus:border-[var(--color-primary)] focus:bg-white focus:outline-none focus:ring-3 focus:ring-[var(--color-focus-ring)] user-invalid:border-[var(--color-error)] user-invalid:focus:ring-[var(--color-error-light)]';
const sectionHeading = 'text-[22px] font-bold tracking-tight text-[var(--color-text-primary)]';
const footerLink = `rounded-sm text-white/85 underline-offset-4 hover:text-white hover:underline ${focusRingOnNavy}`;

export default function SupportPage() {
  const [faqTab, setFaqTab] = useState<FaqTab>('candidate');
  const [openIdx, setOpenIdx] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const items: FaqItem[] = useMemo(() => SUPPORT_FAQS[faqTab], [faqTab]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const subject = encodeURIComponent(`[CareerBridge Support] ${topic || 'General'} — ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div className="support-page min-h-screen bg-[var(--color-background)] font-sans text-[var(--color-text-primary)] [--support-field-border:#8287A0]">
      <header className="bg-[var(--color-primary-dark)] text-white shadow-[0_8px_24px_rgba(16,19,124,0.22)]">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-1">
            <BrandLogo href="/" tone="dark" priority />
            <span className="text-[11px] font-medium tracking-wide text-[var(--color-primary-soft)] sm:text-xs">
              Support Centre
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-medium">
            <a href="#faq" className={navLinkClass}>
              FAQ
            </a>
            <a href="#form" className={navLinkClass}>
              Submit a request
            </a>
            <a href="#contact" className={navLinkClass}>
              Contact
            </a>
            <Link href="/" className={navLinkClass}>
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto max-w-[960px] px-5 py-12 sm:px-7 sm:py-14">
          <p className="mb-2 text-[13px] font-semibold text-[var(--color-primary)]">Help & Support</p>
          <h1 className="max-w-[14ch] text-[clamp(28px,4vw,40px)] font-bold leading-tight tracking-tight text-[var(--color-text-primary)]">
            We&apos;re here to help you move your career forward
          </h1>
          <p className="mt-4 max-w-[56ch] text-base text-[var(--color-text-secondary)]">
            Get answers about your account, applications, and employer connections, or reach our
            support team. Most enquiries are answered within one business day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#form" className={primaryButton}>
              Submit a request
            </a>
            <a href="#faq" className={secondaryButton}>
              Browse the FAQ
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[960px] px-5 sm:px-7">
        <section id="faq" className="border-b border-[var(--color-border)] py-12">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-[var(--color-primary-dark)] pb-3">
            <h2 className={sectionHeading}>Frequently asked questions</h2>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">FAQ</span>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(Object.keys(TAB_LABELS) as FaqTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={faqTab === tab}
                onClick={() => {
                  setFaqTab(tab);
                  setOpenIdx(0);
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${focusRing} ${
                  faqTab === tab
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--color-border-dark)] bg-white text-[var(--color-primary-dark)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-light)]'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          <div>
            {items.map((item, index) => {
              const open = openIdx === index;
              return (
                <details
                  key={`${faqTab}-${item.q}`}
                  open={open}
                  className="border-b border-[var(--color-border)] py-4 first:border-t"
                  onToggle={(event) => {
                    if ((event.target as HTMLDetailsElement).open) setOpenIdx(index);
                  }}
                >
                  <summary
                    className={`flex cursor-pointer list-none items-center justify-between gap-3 rounded-sm text-[15px] font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-primary)] [&::-webkit-details-marker]:hidden ${focusRing}`}
                  >
                    {item.q}
                    <span className="text-xl font-semibold text-[var(--color-primary)]" aria-hidden="true">
                      {open ? '–' : '+'}
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[64ch] text-[14.5px] text-[var(--color-text-secondary)]">{item.a}</p>
                </details>
              );
            })}
          </div>
        </section>

        <section id="form" className="py-12">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-[var(--color-primary-dark)] pb-3">
            <h2 className={sectionHeading}>Submit a support request</h2>
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Request</span>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-[0_2px_8px_rgba(16,19,124,0.04)] sm:p-8">
            <h3 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
              We&apos;ll route this to the right team
            </h3>
            <p className="mt-1 mb-5 text-sm text-[var(--color-text-secondary)]">
              Fields marked with an asterisk are required.
            </p>
            {sent ? (
              <p
                role="status"
                className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success-light)] p-4 text-sm font-semibold text-[var(--color-success-dark)]"
              >
                Your mail client should open with the request. If it doesn&apos;t, email{' '}
                <a className={`rounded-sm underline ${focusRing}`} href={`mailto:${SUPPORT_EMAIL}`}>
                  {SUPPORT_EMAIL}
                </a>
                .
              </p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className={fieldLabel}>
                    Full name *
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={fieldControl}
                    />
                  </label>
                  <label className={fieldLabel}>
                    Email address *
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={fieldControl}
                    />
                  </label>
                </div>
                <label className={fieldLabel}>
                  Topic *
                  <select
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className={fieldControl}
                  >
                    <option value="">Select a topic</option>
                    <option>Account & sign-in</option>
                    <option>Applications & tracking</option>
                    <option>Resumes & profile review</option>
                    <option>Employer partnerships</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className={fieldLabel}>
                  Describe your request *
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className={`${fieldControl} min-h-[100px] resize-y`}
                  />
                </label>
                <button type="submit" className={primaryButton}>
                  Submit request
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      <section
        id="contact"
        className="border-t border-[var(--color-border)] bg-gradient-to-b from-white to-[var(--color-background)] px-5 py-12 sm:px-7"
        aria-labelledby="contact-heading"
      >
        <div className="mx-auto max-w-[960px]">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-[0_12px_40px_rgba(16,19,124,0.08)]">
            <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
              <div className="p-7 sm:p-9">
                <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">
                  Direct contact
                </p>
                <h2
                  id="contact-heading"
                  className="mt-2 text-[clamp(22px,3vw,28px)] font-bold tracking-tight text-[var(--color-text-primary)]"
                >
                  For any query, contact us
                </h2>
                <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[var(--color-text-secondary)]">
                  Reach the SRSB CareerBridge team by email. We typically respond within one
                  business day.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className={`mt-6 inline-flex max-w-full items-center gap-3 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5 hover:bg-[var(--color-primary-hover)] ${focusRing}`}
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-[var(--color-primary)]"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="M3 7l9 7 9-7" />
                    </svg>
                  </span>
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <div className="relative flex flex-col justify-center gap-4 border-t border-[var(--color-border)] bg-[var(--color-primary-dark)] p-7 text-white sm:p-9 md:border-l md:border-t-0">
                <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
                <p className="relative text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--color-primary-soft)]">
                  Prefer email?
                </p>
                <p className="relative text-[15px] leading-relaxed text-white/85">
                  Write to us with your account email and a short description of your question.
                  We&apos;ll route it to the right team.
                </p>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=CareerBridge%20query`}
                  className={`relative inline-flex w-fit items-center gap-2 rounded-sm text-sm font-semibold text-white underline-offset-4 hover:underline ${focusRingOnNavy}`}
                >
                  Open mail app →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[var(--color-primary-dark)] py-9 text-[13px] text-white/80">
        <div className="mx-auto flex max-w-[960px] flex-wrap justify-between gap-4 px-5 sm:px-7">
          <div>© {new Date().getFullYear()} SRSB CareerBridge. Member Support Office.</div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://srsbworkforcesolutions.com/"
              target="_blank"
              rel="noreferrer"
              className={footerLink}
            >
              Website
            </a>
            <a
              href="https://www.linkedin.com/feed/"
              target="_blank"
              rel="noreferrer"
              className={footerLink}
            >
              LinkedIn
            </a>
            <a
              href="https://www.instagram.com/srsb_workforce_solutions/"
              target="_blank"
              rel="noreferrer"
              className={footerLink}
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61581537195947"
              target="_blank"
              rel="noreferrer"
              className={footerLink}
            >
              Facebook
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
