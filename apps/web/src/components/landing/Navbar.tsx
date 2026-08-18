"use client";

import Image from "next/image";
import { useState } from "react";

const links = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#passport", label: "Career Passport" },
  { href: "#jobs", label: "Jobs" },
  { href: "#employers", label: "Employers" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      <div className="absolute inset-0 bg-navy/80 backdrop-blur-xl" />
      <nav className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#top" className="flex items-center gap-2">
          <Image
            src="/srsb-logo.png"
            alt="SRSB"
            width={168}
            height={48}
            className="h-10 w-auto rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.28)] sm:h-11"
            priority
          />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-white/75 transition hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="#signin"
            className="rounded-full px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
          >
            Sign In
          </a>
          <a
            href="#get-started"
            className="rounded-full bg-orange px-4 py-2 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(242,92,34,0.85)] transition hover:-translate-y-0.5 hover:bg-orange-bright"
          >
            Create Free Passport
          </a>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="sr-only">Menu</span>
          <span className="flex flex-col gap-1.5">
            <span
              className={`h-0.5 w-4 bg-white transition ${open ? "translate-y-2 rotate-45" : ""}`}
            />
            <span className={`h-0.5 w-4 bg-white transition ${open ? "opacity-0" : ""}`} />
            <span
              className={`h-0.5 w-4 bg-white transition ${open ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </span>
        </button>
      </nav>

      {open ? (
        <div className="relative border-t border-white/10 bg-navy px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-xl px-3 py-2 text-sm font-medium text-white/85"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <a
              href="#signin"
              className="rounded-xl px-3 py-2 text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Sign In
            </a>
            <a
              href="#get-started"
              className="rounded-full bg-orange px-4 py-3 text-center text-sm font-bold text-white"
              onClick={() => setOpen(false)}
            >
              Create Free Career Passport
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
