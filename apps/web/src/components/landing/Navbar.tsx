"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CreatePassportButton } from "@/features/candidate/passport/CreatePassportButton";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#passport", label: "Career Passport" },
  { href: "#jobs", label: "Jobs" },
  { href: "#employers", label: "Employers" },
];

const DEFAULT_LINK = "Jobs";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(DEFAULT_LINK);
  const navRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState({ left: 0, width: 0, ready: false });

  useEffect(() => {
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
  }, [active]);

  return (
    <header className="site-navbar sticky top-0 z-50">
      <nav className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-6 px-5 sm:h-[84px] sm:px-10">
        <a href="#top" className="logo-mark w-[148px] shrink-0 sm:w-[180px]">
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="h-10 w-auto bg-transparent sm:h-11"
            unoptimized
            priority
          />
        </a>

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
            <a
              key={link.href}
              href={link.href}
              ref={(node) => {
                itemRefs.current[link.label] = node;
              }}
              className={`nav-link${active === link.label ? " nav-link-on" : ""}`}
              onMouseEnter={() => setActive(link.label)}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden w-[148px] shrink-0 items-center justify-end gap-3 sm:w-auto md:flex">
          <a
            href="#signin"
            className="rounded-full border-[1.5px] border-white/55 px-5 py-[11px] text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Sign In
          </a>
          <CreatePassportButton className="rounded-full bg-white px-[22px] py-[11px] text-sm font-bold text-[#0a2e2c] transition hover:-translate-y-px">
            Create Free Passport
          </CreatePassportButton>
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
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${
                  link.label === DEFAULT_LINK
                    ? "nav-pill-fill text-white"
                    : "text-white"
                }`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#signin"
              className="rounded-full border border-white px-4 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Sign In
            </a>
            <CreatePassportButton className="rounded-full bg-white px-4 py-3 text-center text-sm font-bold text-navy">
              Create Free Career Passport
            </CreatePassportButton>
          </div>
        </div>
      ) : null}
    </header>
  );
}
