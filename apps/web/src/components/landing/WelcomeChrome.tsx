'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { HomeBrand } from '@/components/landing/home/HomeBrand';
import { CloseIcon, MenuIcon } from '@/components/landing/home/icons';

type WelcomeRole = 'candidate' | 'employer';

const MENU_ID = 'wl-nav-menu';

export function WelcomeRoleNav({ role }: { role: WelcomeRole }) {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const loginHref = role === 'candidate' ? '/login?role=candidate' : '/login?role=employer';
  const signupHref = role === 'candidate' ? '/register?role=candidate' : '/employer/register';
  const brandHref = role === 'candidate' ? '/welcome' : '/employer/welcome';

  const links = [
    { href: '/', label: 'Home', current: false },
    { href: '/welcome', label: 'Candidates', current: role === 'candidate' },
    { href: '/employer/welcome', label: 'Employers', current: role === 'employer' },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className="wl-header">
      <nav className={`hl-nav${open ? ' is-open' : ''}`} aria-label="Main">
        <HomeBrand href={brandHref} priority />

        <button
          ref={burgerRef}
          type="button"
          className="hl-nav__burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls={MENU_ID}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        </button>

        <div className="hl-nav__menu" id={MENU_ID}>
          <ul className="hl-nav__links">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`hl-nav__link${link.current ? ' is-active' : ''}`}
                  aria-current={link.current ? 'page' : undefined}
                  onClick={close}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hl-nav__actions">
            <Link href={loginHref} onClick={close} className="hl-btn hl-btn--ghost hl-btn--nav hl-nav__login">
              Login
            </Link>
            <Link href={signupHref} onClick={close} className="hl-btn hl-btn--primary hl-btn--nav">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
