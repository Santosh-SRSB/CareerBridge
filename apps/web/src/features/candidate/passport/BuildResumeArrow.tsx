"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EagleMascot } from "@/features/candidate/passport/EagleMascot";

export function BuildResumeArrow() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 1600);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="build-stage">
      <span className="ai-glow" aria-hidden="true">
        AI
      </span>
      <div className="build-arrow-wrap">
        <div className="build-eagle">
          <EagleMascot pose="arrow" />
        </div>
        <div className="build-arrow">
          <span>Build Your resume</span>
        </div>
      </div>
      {ready ? (
        <button
          type="button"
          className="cta-shine mt-10 inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-bold text-white"
          onClick={() => router.push("/passport/create/form?source=manual")}
        >
          Continue to Career Passport
        </button>
      ) : null}
    </div>
  );
}
