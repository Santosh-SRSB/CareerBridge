"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BRAND_LOGO_HEIGHT, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH, BRAND_NAME } from "@/components/brand/BrandLogo";

/** Full-bleed SRSB mark for route-level loading only (not the early landing gate). */
export function BrandSplash() {
  return (
    <div className="app-loader-inner">
      <div className="app-loader-row app-loader-row--wide">
        <div className="app-loader-logo app-loader-logo--wide">
          <Image
            src={BRAND_LOGO_SRC}
            alt={BRAND_NAME}
            width={BRAND_LOGO_WIDTH}
            height={BRAND_LOGO_HEIGHT}
            className="app-loader-wordmark h-auto w-[90vw] max-w-[520px] object-contain"
            unoptimized
            priority
          />
          <span className="app-loader-shine" aria-hidden="true" />
        </div>
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
