import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

export type LegalSection = {
  id: string;
  title: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: Array<{
    title: string;
    paragraphs?: string[];
    bullets?: string[];
  }>;
};

export function LegalPageShell({
  title,
  subtitle,
  effectiveDate,
  lastUpdated,
  children,
  relatedLinks,
  pdfHref,
}: {
  title: string;
  subtitle?: string;
  effectiveDate?: string;
  lastUpdated?: string;
  children: ReactNode;
  relatedLinks?: Array<{ href: string; label: string }>;
  pdfHref?: string;
}) {
  return (
    <main className="min-h-screen bg-[#f0f4f8] text-[#0f172a]">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Logo />
          <Link href="/" className="text-sm font-semibold text-[#0d9488] hover:underline">
            Back to home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-10 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0d9488]">
          SRSB CareerBridge
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[#0a2e2c] sm:text-4xl">
          {title}
        </h1>
        {subtitle ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{subtitle}</p> : null}
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
          {effectiveDate ? <span>Effective: {effectiveDate}</span> : null}
          {lastUpdated ? <span>Last updated: {lastUpdated}</span> : null}
        </div>

        {relatedLinks?.length ? (
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Related legal documents">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-[#0d9488]/25 bg-white px-3 py-1.5 text-xs font-bold text-[#0a2e2c] transition hover:border-[#0d9488] hover:text-[#0d9488]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}

        {pdfHref ? (
          <p className="mt-4">
            <a
              href={pdfHref}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-[#0d9488] hover:underline"
            >
              Download PDF
            </a>
          </p>
        ) : null}

        <div className="mt-8 space-y-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8">
          {children}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} SRSB Workforce Solutions Pvt. Ltd. All rights reserved.
        </p>
      </article>
    </main>
  );
}

export function LegalSections({ sections }: { sections: LegalSection[] }) {
  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-8">
          <h2 className="text-lg font-black text-[#0a2e2c]">{section.title}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p.slice(0, 48)} className="mt-3 text-sm leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
          {section.bullets?.length ? (
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
              {section.bullets.map((b) => (
                <li key={b.slice(0, 64)}>{b}</li>
              ))}
            </ul>
          ) : null}
          {section.subsections?.map((sub) => (
            <div key={sub.title || sub.paragraphs?.[0]?.slice(0, 40) || sub.bullets?.[0]?.slice(0, 40)} className="mt-5">
              {sub.title ? <h3 className="text-sm font-bold text-[#0a2e2c]">{sub.title}</h3> : null}
              {sub.paragraphs?.map((p) => (
                <p key={p.slice(0, 48)} className="mt-2 text-sm leading-relaxed text-slate-700">
                  {p}
                </p>
              ))}
              {sub.bullets?.length ? (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700">
                  {sub.bullets.map((b) => (
                    <li key={b.slice(0, 64)}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
