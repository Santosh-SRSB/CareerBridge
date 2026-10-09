"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type FocusEvent } from "react";
import type { AuthUser } from "@careerbridge/shared";
import { logout } from "@/lib/api";
import { getStoredUser, homePathForUser } from "@/lib/session";
import { HomeBrand } from "./HomeBrand";
import { CloseIcon, MenuIcon } from "./icons";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/employer/welcome", label: "Employer" },
  { href: "/welcome", label: "Candidate" },
  { href: "/testimonials", label: "Testimonial" },
] as const;

const MENU_ID = "hl-nav-menu";

function subscribeToStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readStoredUser() {
  const user = getStoredUser();
  return user?.id ? JSON.stringify(user) : null;
}

function readServerUser() {
  return null;
}

function useStoredUser(): AuthUser | null {
  const raw = useSyncExternalStore(subscribeToStorage, readStoredUser, readServerUser);
  return useMemo(() => (raw ? (JSON.parse(raw) as AuthUser) : null), [raw]);
}

type Highlight = { focus: string | null; hover: string | null };

type NavBarProps = {
  signedIn: boolean;
  homeHref: string;
  mirror?: boolean;
  open?: boolean;
  highlight?: Highlight;
  onHighlight?: (kind: keyof Highlight, key: string | null) => void;
  onToggle?: () => void;
  onNavigate?: () => void;
  onLogout?: () => void;
};

function NavBar({
  signedIn,
  homeHref,
  mirror = false,
  open = false,
  highlight,
  onHighlight,
  onToggle,
  onNavigate,
  onLogout,
}: NavBarProps) {
  /** The real bar reports focus/hover; the white copy over the dark panel echoes it. */
  const track = (key: string) =>
    mirror
      ? {
          className: `${highlight?.focus === key ? " is-focus" : ""}${
            highlight?.hover === key ? " is-hover" : ""
          }`,
        }
      : {
          className: "",
          onFocus: (event: FocusEvent<HTMLElement>) =>
            onHighlight?.("focus", event.currentTarget.matches(":focus-visible") ? key : null),
          onBlur: () => onHighlight?.("focus", null),
          onMouseEnter: () => onHighlight?.("hover", key),
          onMouseLeave: () => onHighlight?.("hover", null),
        };

  const primaryAction = track("primary");
  const secondaryAction = track("secondary");

  return (
    <nav
      className={`hl-nav${open ? " is-open" : ""}${mirror ? " hl-nav--mirror" : ""}`}
      aria-label={mirror ? undefined : "Main"}
    >
      <HomeBrand href={signedIn ? homeHref : "/"} priority={!mirror} />

      {mirror ? null : (
        <button
          type="button"
          className="hl-nav__burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls={MENU_ID}
          onClick={onToggle}
        >
          {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
        </button>
      )}

      <div className="hl-nav__menu" id={mirror ? undefined : MENU_ID}>
        <ul className="hl-nav__links">
          {NAV_LINKS.map((link) => {
            const current = link.href === "/";
            const { className, ...events } = track(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`hl-nav__link${current ? " is-active" : ""}${className}`}
                  aria-current={current ? "page" : undefined}
                  onClick={onNavigate}
                  {...events}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hl-nav__actions">
          {signedIn ? (
            <>
              <Link
                href={homeHref}
                onClick={onNavigate}
                {...secondaryAction}
                className={`hl-btn hl-btn--ghost hl-btn--nav hl-nav__login${secondaryAction.className}`}
              >
                My home
              </Link>
              <button
                type="button"
                onClick={onLogout}
                {...primaryAction}
                className={`hl-btn hl-btn--primary hl-btn--nav${primaryAction.className}`}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={onNavigate}
                {...secondaryAction}
                className={`hl-btn hl-btn--ghost hl-btn--nav hl-nav__login${secondaryAction.className}`}
              >
                Login
              </Link>
              <Link
                href="/register?role=candidate"
                onClick={onNavigate}
                {...primaryAction}
                className={`hl-btn hl-btn--primary hl-btn--nav${primaryAction.className}`}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/**
 * Landing navigation. The hero's dark panel cuts across the bar, so a white copy of the
 * nav is clipped to the panel shape; it is inert and hidden from assistive tech.
 */
export function HomeNavbar() {
  const router = useRouter();
  const user = useStoredUser();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<Highlight>({ focus: null, hover: null });

  const signedIn = Boolean(user?.id);
  const homeHref = homePathForUser(user);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function onLogout() {
    try {
      await logout();
    } finally {
      setOpen(false);
      router.replace("/");
    }
  }

  return (
    <>
      <div className="hl-hero__panel-clip" aria-hidden="true" inert>
        <div className="hl-hero__panel-pin">
          <NavBar signedIn={signedIn} homeHref={homeHref} highlight={highlight} mirror />
        </div>
      </div>
      <NavBar
        signedIn={signedIn}
        homeHref={homeHref}
        open={open}
        onHighlight={(kind, key) => setHighlight((prev) => ({ ...prev, [kind]: key }))}
        onToggle={() => setOpen((value) => !value)}
        onNavigate={() => setOpen(false)}
        onLogout={() => void onLogout()}
      />
    </>
  );
}
