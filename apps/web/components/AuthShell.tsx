import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SiteHeader } from '@/components/SiteHeader';
import { AnimatedBackdrop } from '@/components/AnimatedBackdrop';
import { AuthHeroFx } from '@/components/AuthHeroFx';
import { TiltCard } from '@/components/TiltCard';

export { Logo };

export function AuthShell({
  title,
  subtitle,
  backHref,
  marketing = true,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  scene?: 'candidate' | 'employer' | 'verify';
  panelTitle?: string;
  panelCopy?: string;
  marketing?: boolean;
  children: ReactNode;
}) {
  if (!marketing) {
    return (
      <main className="relative min-h-screen">
        <AnimatedBackdrop />
        <div className="relative mx-auto max-w-md px-5 py-8">
          <div className="flex items-center justify-between">
            <Logo />
            {backHref ? (
              <Link href={backHref} className="text-sm font-semibold text-accent">
                ← Back
              </Link>
            ) : null}
          </div>
          <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-primary">{title}</h1>
          {subtitle ? <p className="mt-2 text-muted">{subtitle}</p> : null}
          <div className="cb-card mt-6 p-6">{children}</div>
          <div id="recaptcha-container" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-primary">
      <SiteHeader />
      <section className="relative flex min-h-[calc(100dvh-4.5rem)] items-center justify-center overflow-hidden px-5 py-10">
        <AuthHeroFx />
        <div className="relative z-10 w-full max-w-[360px]">
          {backHref ? (
            <Link href={backHref} className="mb-3 inline-block text-sm font-semibold text-orange transition hover:text-white">
              ← Back
            </Link>
          ) : null}
          <TiltCard>
            <div className="h-1 bg-gradient-to-r from-orange via-white to-teal" />
            <div className="px-5 pt-4 text-center">
              <h1 className="text-xl font-extrabold tracking-tight text-primary">{title}</h1>
            </div>
            <div className="px-5 pb-5 pt-3">{children}</div>
          </TiltCard>
        </div>
        <div id="recaptcha-container" />
      </section>
    </main>
  );
}
