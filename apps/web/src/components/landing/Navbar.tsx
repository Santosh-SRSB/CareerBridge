"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { getStoredUser, homePathForUser } from "@/lib/session";
import type { AuthUser } from "@careerbridge/shared";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#passport", label: "Career Passport" },
  { href: "#jobs", label: "Jobs" },
  { href: "/employer/welcome", label: "Employers" },
];

const DEFAULT_LINK = "Jobs";

export function Navbar({ landingLinks = true }: { landingLinks?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(DEFAULT_LINK);
  const [user, setUser] = useState<AuthUser | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  const signedIn = Boolean(user?.id);
  const homeHref = homePathForUser(user);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (!landingLinks) return;
    const movePill = () => {
      const parent = navRef.current;
      const el = itemRefs.current[active];
      if (!parent || !el) return;
      const parentBox = parent.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      setPill({
        left: box.left - parentBox.left,
        width: box.width,
        ready: true,
      });
    };

    movePill();
    window.addEventListener("resize", movePill);
    return () => window.removeEventListener("resize", movePill);
  }, [active, landingLinks]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      setOpen(false);
      router.replace("/");
    }
  }

  return (
    <header className="site-navbar sticky top-0 z-50">
      <nav className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-5 sm:h-[84px] sm:px-10">
        <Link href={signedIn ? homeHref : "/"} className="logo-mark w-[148px] shrink-0 sm:w-[180px]">
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="h-10 w-auto bg-transparent sm:h-11"
            unoptimized
            priority
          />
        </Link>

        {landingLinks ? (
          <div
            ref={navRef}
            className="relative hidden flex-1 items-center justify-center md:flex"
            onMouseLeave={() => setActive(DEFAULT_LINK)}
          >
            <span
              className="nav-pill nav-pill-shimmer"
              style={{
                opacity: pill.ready ? 1 : 0,
                transform: `translateX(${pill.left}px)`,
                width: pill.width,
              }}
            />
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                ref={(node: HTMLAnchorElement | null) => {
                  itemRefs.current[link.label] = node;
                }}
                className={`nav-link${active === link.label ? " nav-link-on" : ""}`}
                onMouseEnter={() => setActive(link.label)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : (
          <div className="hidden min-w-0 flex-1 md:block" />
        )}

        <div className="hidden w-[148px] shrink-0 items-center justify-end gap-3 sm:w-auto md:flex">
          {signedIn ? (
            <>
              <Link
                href={homeHref}
                className="rounded-full border-[1.5px] border-white/55 px-5 py-[11px] text-sm font-semibold text-white transition hover:bg-white/10"
              >
                My home
              </Link>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="rounded-full bg-white px-[18px] py-[11px] text-sm font-bold text-[#0a2e2c] transition hover:-translate-y-px"
              >
                Logout
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm font-semibold text-white">
              <Link href="/login" className="transition hover:text-accent">
                Login
              </Link>
              <span className="text-white/45" aria-hidden="true">
                |
              </span>
              <Link href="/register?role=candidate" className="transition hover:text-accent">
                Signup
              </Link>
            </p>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white text-white transition hover:bg-white hover:text-navy md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <span className="flex flex-col gap-1.5">
            <span
              className={`h-0.5 w-4 bg-current transition ${open ? "translate-y-2 rotate-45" : ""}`}
            />
            <span className={`h-0.5 w-4 bg-current transition ${open ? "opacity-0" : ""}`} />
            <span
              className={`h-0.5 w-4 bg-current transition ${open ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </span>
        </button>
      </nav>

      {open ? (
        <div className="border-t border-white/15 bg-navbar px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {landingLinks
              ? links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${
                      link.label === DEFAULT_LINK ? "nav-pill-fill text-white" : "text-white"
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))
              : null}
            {signedIn ? (
              <>
                <Link
                  href={homeHref}
                  className="rounded-full border border-white px-4 py-2.5 text-center text-sm font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  My home
                </Link>
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="rounded-full bg-white px-4 py-3 text-center text-sm font-bold text-navy"
                >
                  Logout
                </button>
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 py-2 text-sm font-semibold text-white">
                <Link href="/login" onClick={() => setOpen(false)}>
                  Login
                </Link>
                <span className="text-white/45" aria-hidden="true">
                  |
                </span>
                <Link href="/register?role=candidate" onClick={() => setOpen(false)}>
                  Signup
                </Link>
              </p>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
