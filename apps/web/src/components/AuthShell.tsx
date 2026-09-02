import type { ReactNode } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { SiteHeader } from '@/components/SiteHeader';
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

  return (
    <main className="min-h-screen w-full flex flex-col bg-[#f0f4f8] text-[#0f172a]">
      <SiteHeader />
      <div className="flex-1 flex items-center justify-center p-3 sm:p-5 md:p-8">
        {/* Main 2-column container card matching the reference design */}
        <div className="relative w-full max-w-5xl lg:max-w-6xl xl:max-w-[1160px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(15,23,42,0.08)] overflow-hidden grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] border border-slate-200/80">
          
          {/* Left Hero Column (Responsive: visible cleanly on mobile & desktop) */}
          <AuthSplitHero
            headline={panelTitle || (scene === 'employer' ? 'Hire verified talent simply and quickly' : 'Find your dream job simply and quickly')}
            subhead={panelCopy || (scene === 'employer' ? 'Connect directly with scored candidates, track verified skills, and streamline your recruitment.' : 'Build your verified Career Passport, practice with AI interviews, and get discovered by top companies.')}
            scene={scene}
          />

          {/* Right Form Column */}
          <div className="flex flex-col justify-between p-6 sm:p-8 md:p-10 lg:p-10 xl:p-12 bg-white">
            <div className="w-full max-w-[420px] mx-auto my-auto">
              {backHref ? (
                <Link href={backHref} className="mb-3 inline-block text-xs font-bold text-[#0284c7] hover:underline">
                  ← Back
                </Link>
              ) : null}

              {/* Form Title & Subtitle */}
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
            <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1.5">
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
