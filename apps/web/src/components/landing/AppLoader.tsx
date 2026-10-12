"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND_LOGO_HEIGHT, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH } from "@/components/brand/BrandLogo";

const STATUS_STEP_MS = 700;

const EMPLOYER_STATUS_LINES = ["Opening employer workspace", "Loading jobs", "Checking candidates", "Ready"];
const DEFAULT_STATUS_LINES = ["Opening your workspace", "Loading jobs", "Checking applications", "Ready"];

function statusLinesFor(pathname: string | null) {
  return pathname?.startsWith("/employer") ? EMPLOYER_STATUS_LINES : DEFAULT_STATUS_LINES;
}

/** SRSB loading card: rising mark, stepped status line and an indeterminate bar. */
export function BrandSplash() {
  const lines = statusLinesFor(usePathname());
  const [step, setStep] = useState(0);

  useEffect(() => {
    let current = 0;
    const timer = window.setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= lines.length - 1) window.clearInterval(timer);
    }, STATUS_STEP_MS);
    return () => window.clearInterval(timer);
  }, [lines]);

  return (
    <>
      <span className="sr-only">Loading CareerBridge</span>
      <div className="app-loader-card" aria-hidden="true">
        <Image
          src={BRAND_LOGO_SRC}
          alt=""
          width={BRAND_LOGO_WIDTH}
          height={BRAND_LOGO_HEIGHT}
          className="app-loader-mark"
          unoptimized
          priority
        />
        <p className="app-loader-title">CareerBridge</p>
        <p className="app-loader-status">{lines[Math.min(step, lines.length - 1)]}</p>
        <div className="app-loader-bar">
          <span />
        </div>
      </div>
    </>
  );
}

export function AppLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 600 : 3600;
    const fade = reduce ? 200 : 600;
    const out = window.setTimeout(() => setLeaving(true), hold);
    const hide = window.setTimeout(() => setVisible(false), hold + fade);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`app-loader${leaving ? " is-out" : ""}`} role="status" aria-live="polite">
      <BrandSplash />
    </div>
  );
}
