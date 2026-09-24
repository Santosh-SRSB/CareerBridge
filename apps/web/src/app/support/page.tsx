'use client';

import { FormEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SUPPORT_FAQS, type FaqItem } from '@/data/support-faqs';

type FaqTab = 'candidate' | 'employer' | 'general';

const TAB_LABELS: Record<FaqTab, string> = {
  candidate: 'Candidate FAQ',
  employer: 'Employer FAQ',
  general: 'General FAQ',
};

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
    window.location.href = `mailto:support@srsbcareerbridge.org?subject=${subject}&body=${body}`;
    setSent(true);
  }

  return (
    <div className="support-page min-h-screen bg-[#F6F5F1] text-[#1B2027]">
      <header className="border-b-4 border-[#A9812F] bg-[#0a2e2c] text-white">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-7">
          <Link href="/" className="flex items-center gap-3 text-white no-underline" aria-label="SRSB Career Bridge">
            <Image
              src="/srsb-mark.png"
              alt=""
              width={200}
              height={56}
              className="h-11 w-auto max-w-[160px] object-contain sm:h-12 sm:max-w-[180px]"
              unoptimized
              priority
            />
            <span className="flex flex-col leading-tight">
              <span className="font-[family-name:var(--font-poppins),system-ui,sans-serif] text-base font-bold tracking-tight text-white sm:text-lg">
                Career Bridge
              </span>
              <span className="text-[11px] font-medium tracking-wide text-[#c8e6d4] sm:text-xs">
                Support Centre
              </span>
            </span>
          </Link>
          <nav className="flex gap-5 text-sm">
            <a href="#faq" className="text-[#d5e0d9] no-underline hover:border-b hover:border-[#A9812F]">
              FAQ
            </a>
            <a href="#form" className="text-[#d5e0d9] no-underline hover:border-b hover:border-[#A9812F]">
              Submit a request
            </a>
            <Link href="/" className="text-[#d5e0d9] no-underline hover:border-b hover:border-[#A9812F]">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <div className="border-b border-[#C9C4B4] bg-[#EDEBE3]">
        <div className="mx-auto max-w-[960px] px-5 py-12 sm:px-7 sm:py-14">
          <p className="mb-2 text-[13px] font-semibold text-[#0a2e2c]">Help & Support</p>
          <h1 className="max-w-[14ch] font-[family-name:var(--font-fraunces),Georgia,serif] text-[clamp(28px,4vw,40px)] font-bold leading-tight text-[#0a2e2c]">
            We&apos;re here to help you move your career forward
          </h1>
          <p className="mt-4 max-w-[56ch] text-base text-[#3B4451]">
            Get answers about your account, applications, and employer connections, or reach our
            support team. Most enquiries are answered within one business day.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="#form"
              className="inline-block border border-[#0a2e2c] bg-[#0a2e2c] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Submit a request
            </a>
            <a
              href="#faq"
              className="inline-block border border-[#0a2e2c] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#0a2e2c]"
            >
              Browse the FAQ
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[960px] px-5 sm:px-7">
        <section id="faq" className="border-b border-[#C9C4B4] py-12">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-[#0a2e2c] pb-3">
            <h2 className="font-[family-name:var(--font-fraunces),Georgia,serif] text-[22px] font-bold text-[#0a2e2c]">
              Frequently asked questions
            </h2>
            <span className="text-xs font-medium text-[#7C8494]">FAQ</span>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {(Object.keys(TAB_LABELS) as FaqTab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setFaqTab(tab);
                  setOpenIdx(0);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  faqTab === tab
                    ? 'bg-[#0a2e2c] text-white'
                    : 'border border-[#C9C4B4] bg-white text-[#0a2e2c]'
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
                  className="border-b border-[#C9C4B4] py-4 first:border-t"
                  onToggle={(event) => {
                    if ((event.target as HTMLDetailsElement).open) setOpenIdx(index);
                  }}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-[#0a2e2c] [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="font-[family-name:var(--font-fraunces),Georgia,serif] text-xl text-[#A9812F]">
                      {open ? '–' : '+'}
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[64ch] text-[14.5px] text-[#454D5C]">{item.a}</p>
                </details>
              );
            })}
          </div>
        </section>

        <section id="form" className="py-12">
          <div className="mb-7 flex items-baseline justify-between border-b-2 border-[#0a2e2c] pb-3">
            <h2 className="font-[family-name:var(--font-fraunces),Georgia,serif] text-[22px] font-bold text-[#0a2e2c]">
              Submit a support request
            </h2>
            <span className="text-xs font-medium text-[#7C8494]">Request</span>
          </div>

          <div className="border border-[#C9C4B4] bg-white p-6 sm:p-8">
            <h3 className="font-[family-name:var(--font-fraunces),Georgia,serif] text-xl font-bold text-[#0a2e2c]">
              We&apos;ll route this to the right team
            </h3>
            <p className="mt-1 mb-5 text-sm text-[#4A5262]">
              Fields marked with an asterisk are required.
            </p>
            {sent ? (
              <p className="rounded-md border border-[#A9812F]/40 bg-[#F6F5F1] p-4 text-sm font-semibold text-[#0a2e2c]">
                Your mail client should open with the request. If it doesn&apos;t, email{' '}
                <a className="underline" href="mailto:support@srsbcareerbridge.org">
                  support@srsbcareerbridge.org
                </a>
                .
              </p>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-[13px] font-semibold text-[#0a2e2c]">
                    Full name *
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 w-full border border-[#B9B4A4] bg-[#F6F5F1] px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-[13px] font-semibold text-[#0a2e2c]">
                    Email address *
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full border border-[#B9B4A4] bg-[#F6F5F1] px-3 py-2.5 text-sm"
                    />
                  </label>
                </div>
                <label className="block text-[13px] font-semibold text-[#0a2e2c]">
                  Topic *
                  <select
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="mt-1.5 w-full border border-[#B9B4A4] bg-[#F6F5F1] px-3 py-2.5 text-sm"
                  >
                    <option value="">Select a topic</option>
                    <option>Account & sign-in</option>
                    <option>Applications & tracking</option>
                    <option>Resumes & profile review</option>
                    <option>Employer partnerships</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="block text-[13px] font-semibold text-[#0a2e2c]">
                  Describe your request *
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1.5 min-h-[100px] w-full resize-y border border-[#B9B4A4] bg-[#F6F5F1] px-3 py-2.5 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="border border-[#0a2e2c] bg-[#0a2e2c] px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Submit request
                </button>
              </form>
            )}
          </div>
        </section>
      </div>

      <footer className="bg-[#0a2e2c] py-9 text-[13px] text-[#c8e6d4]">
        <div className="mx-auto flex max-w-[960px] flex-wrap justify-between gap-4 px-5 sm:px-7">
          <div>© {new Date().getFullYear()} SRSB Career Bridge. Member Support Office.</div>
          <div className="flex flex-wrap gap-3">
            <a
              href="https://srsbworkforcesolutions.com/"
              target="_blank"
              rel="noreferrer"
              className="text-[#c8e6d4]"
            >
              Website
            </a>
            <a
              href="https://www.linkedin.com/feed/"
              target="_blank"
              rel="noreferrer"
              className="text-[#c8e6d4]"
            >
              LinkedIn
            </a>
            <a
              href="https://www.instagram.com/srsb_workforce_solutions/"
              target="_blank"
              rel="noreferrer"
              className="text-[#c8e6d4]"
            >
              Instagram
            </a>
            <a
              href="https://www.facebook.com/profile.php?id=61581537195947"
              target="_blank"
              rel="noreferrer"
              className="text-[#c8e6d4]"
            >
              Facebook
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
