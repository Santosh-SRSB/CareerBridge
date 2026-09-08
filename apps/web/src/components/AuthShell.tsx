import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { AnimatedBackdrop } from '@/components/AnimatedBackdrop';
import { AuthSplitHero } from '@/components/AuthSplitHero';

export { Logo };

export function AuthShell({
  title,
  subtitle,
  backHref,
  marketing = true,
  maxWidthClass = 'max-w-[500px]',
  scene = 'candidate',
  panelTitle,
  panelCopy,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  scene?: 'candidate' | 'employer' | 'verify';
  panelTitle?: string;
  panelCopy?: string;
  marketing?: boolean;
  maxWidthClass?: string;
  children: ReactNode;
}) {
  if (!marketing) {
    return (
      <main className="relative min-h-screen bg-fog">
        <AnimatedBackdrop />
        <div className={`relative mx-auto w-full ${maxWidthClass} px-5 py-8`}>
          <div className="flex items-center justify-between">
            <Logo />
            {backHref ? (
              <Link href={backHref} className="text-sm font-semibold text-teal hover:underline">
                ← Back
              </Link>
            ) : null}
          </div>
          <h1 className="mt-8 text-2xl sm:text-3xl font-black tracking-tight text-primary">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-6 rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-primary/10">{children}</div>
          <div id="recaptcha-container" />
        </div>
      </main>
    );
  }

  const heroHeadline =
    panelTitle ||
    (scene === 'employer'
      ? 'Hire verified talent simply and quickly'
      : 'Find your dream job simply and quickly');

  return (
    <main className="min-h-screen w-full flex flex-col bg-[#f0f4f8] text-[#0f172a]">
      <div className="flex flex-1 items-center justify-center px-3 py-5 sm:px-5 md:px-6 lg:px-8">
        <div className="relative w-full max-w-6xl xl:max-w-[1160px] bg-white rounded-2xl md:rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden border border-slate-200/80 flex flex-col md:flex-row md:min-h-[min(680px,calc(100dvh-3rem))]">
          <Link
            href={backHref ?? '/'}
            className="absolute right-4 top-4 z-20 inline-flex items-center gap-1 text-sm font-semibold text-[#142a4f] transition hover:text-[#43526b] sm:right-5 sm:top-5"
          >
            Back ←
          </Link>
          <AuthSplitHero headline={heroHeadline} subhead={panelCopy} scene={scene} />

          <div className="flex flex-1 flex-col justify-between p-5 pt-12 sm:p-6 sm:pt-14 md:p-8 md:pt-16 lg:p-10 xl:p-12 bg-white min-w-0">
            <div className="w-full max-w-[420px] mx-auto md:my-auto">
              <div className="mb-5 text-center md:hidden">
                <p className="text-xl font-black tracking-tight text-[#0a2e2c]">
                  Career<span className="text-[#0d9488]">Bridge</span>
                </p>
                <p className="mt-2 text-sm font-semibold leading-snug text-[#0a2e2c]">
                  {heroHeadline}
                </p>
              </div>

              <div className="mb-4">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0f172a] leading-tight">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              {/* Injected Form Component */}
              <div className="cb-auth-portal">
                {children}
              </div>
            </div>

            {/* Bottom Form Footer Notes */}
            <div className="mt-6 hidden pt-4 border-t border-slate-100 text-center text-xs text-slate-400 md:flex flex-col sm:flex-row items-center justify-between gap-1.5">
              <div className="flex items-center gap-3 font-medium">
                <Link href="/terms" className="hover:text-slate-600 transition">Terms of Service</Link>
                <span>|</span>
                <Link href="/privacy" className="hover:text-slate-600 transition">Privacy Policy</Link>
              </div>
              <p className="font-medium">CareerBridge 2026. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
      <div id="recaptcha-container" />
    </main>
  );
}
