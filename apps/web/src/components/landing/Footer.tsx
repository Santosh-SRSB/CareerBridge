"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser, homePathForUser } from "@/lib/session";
import type { AuthUser } from "@careerbridge/shared";

export function Footer() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const signedIn = Boolean(user?.id);
  const homeHref = homePathForUser(user);

  return (
    <footer id="signin" className="bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="h-10 w-auto bg-transparent"
            unoptimized
          />
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">
            SRSB CareerBridge — a free Career Passport for youth, and a hiring
            workspace for employers.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
            Candidates
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>
              {signedIn ? (
                <Link href={homeHref} className="hover:text-white">
                  My home
                </Link>
              ) : (
                <Link href="/login" className="hover:text-white">
                  Login
                </Link>
              )}
            </li>
            <li>
              {signedIn ? (
                <a href="/jobs" className="hover:text-white">
                  Explore Jobs
                </a>
              ) : (
                <Link href="/register?role=candidate" className="hover:text-white">
                  Signup
                </Link>
              )}
            </li>
            <li>
              <a href={signedIn ? "/interviews" : "#passport"} className="hover:text-white">
                AI Resume & Interviews
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-bright">
            {signedIn ? "Continue" : "Get started"}
          </p>
          <p className="mt-4 text-sm text-white/70">
            {signedIn
              ? "Go back to your dashboard to keep building your Career Passport."
              : "Log in or sign up to start your free Career Passport."}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            {signedIn ? (
              <Link
                href={homeHref}
                className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-bold text-navy"
              >
                My home
              </Link>
            ) : (
              <p className="text-sm font-bold text-white">
                <Link href="/login" className="hover:text-accent">
                  Login
                </Link>
                <span className="mx-2 text-white/40" aria-hidden="true">
                  |
                </span>
                <Link href="/register?role=candidate" className="hover:text-accent">
                  Signup
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} SRSB · CareerBridge · Candidates never pay
        for core tools
      </div>
    </footer>
  );
}
