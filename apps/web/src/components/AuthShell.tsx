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
  mode = 'signin',
  signInHref,
  registerHref,
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
  mode?: 'signin' | 'register';
  signInHref?: string;
  registerHref?: string;
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
          <div
            id="recaptcha-container"
            style={{
              position: 'fixed',
              left: '-9999px',
              bottom: 0,
              width: 1,
              height: 1,
              opacity: 0,
              overflow: 'hidden',
            }}
          />
        </div>
      </main>
    );
  }

  const loginLink = signInHref || (scene === 'employer' ? '/login?role=employer' : '/login?role=candidate');
  const signupLink =
    registerHref || (scene === 'employer' ? '/register?role=employer' : '/register?role=candidate');
  const heading = mode === 'register' ? 'USER REGISTER' : 'USER LOGIN';
  const headerCtaHref = mode === 'register' ? loginLink : signupLink;
  const headerCtaLabel = mode === 'register' ? 'Sign in' : 'Register';

  return (
    <main className="cb-auth-page">
      <div className="cb-auth-page__shapes" aria-hidden>
        <span className="cb-auth-page__blob cb-auth-page__blob--a" />
        <span className="cb-auth-page__blob cb-auth-page__blob--b" />
        <span className="cb-auth-page__blob cb-auth-page__blob--c" />
        <span className="cb-auth-page__blob cb-auth-page__blob--d" />
      </div>

      <div className="cb-auth-page__frame">
        <div className="cb-auth-sheet">
          <div className="cb-auth-sheet__body">
            <AuthSplitHero mode={mode} />

            <section className="cb-auth-form">
              <div className="cb-auth-form__toolbar">
                <div className="cb-auth-form__actions">
                  <Link href={headerCtaHref} className="cb-auth-sheet__cta">
                    {headerCtaLabel}
                  </Link>
                  {backHref ? (
                    <Link href={backHref} className="cb-auth-sheet__back">
                      ← Back
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="cb-auth-form__scroll">
                <div className="cb-auth-form__body">
                  <h1 className="sr-only">{heading}</h1>
                  {subtitle ? <p className="cb-auth-form__sub">{subtitle}</p> : null}
                  <div className="cb-auth-portal">{children}</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div
        id="recaptcha-container"
        style={{
          position: 'fixed',
          left: '-9999px',
          bottom: 0,
          width: 1,
          height: 1,
          opacity: 0,
          overflow: 'hidden',
        }}
      />
    </main>
  );
}
