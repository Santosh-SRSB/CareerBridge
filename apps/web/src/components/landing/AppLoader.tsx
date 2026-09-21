"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function BrandSplash() {
  return (
    <div className="app-loader-inner">
      <div className="app-loader-row">
        <div className="app-loader-logo">
          <Image
            src="/srsb-mark.png"
            alt="SRSB"
            width={88}
            height={88}
            className="app-loader-wordmark h-14 w-14 object-contain"
            unoptimized
            priority
          />
          <span className="app-loader-shine" aria-hidden="true" />
        </div>
        <span className="app-loader-ring" aria-hidden="true" />
      </div>
      <p className="app-loader-text">Loading CareerBridge</p>
    </div>
  );
}

export function AppLoader() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hold = reduce ? 400 : 2000;
    const fade = reduce ? 200 : 500;
    const out = window.setTimeout(() => setLeaving(true), hold);
    const hide = window.setTimeout(() => setVisible(false), hold + fade);
    return () => {
      window.clearTimeout(out);
      window.clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`app-loader${leaving ? " is-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading CareerBridge"
    >
      <BrandSplash />
    </div>
  );
}
