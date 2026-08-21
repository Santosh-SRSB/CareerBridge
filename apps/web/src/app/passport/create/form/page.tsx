"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PassportForm } from "@/features/candidate/passport/PassportForm";
import { EagleMascot } from "@/features/candidate/passport/EagleMascot";
import { DRAFT_KEY, EMPTY_DRAFT, type PassportDraft } from "@/types/passport";

export default function PassportFormPage() {
  const [draft, setDraft] = useState<PassportDraft | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "manual") {
      setDraft({ ...EMPTY_DRAFT, source: "manual" });
      return;
    }
    const raw = sessionStorage.getItem(DRAFT_KEY);
    setDraft(raw ? (JSON.parse(raw) as PassportDraft) : { ...EMPTY_DRAFT, source: "resume" });
  }, []);

  return (
    <div className="min-h-full bg-fog">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">
          Career Passport
        </p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">
          Complete your profile
        </h1>
        <p className="mt-3 text-sm text-muted">
          Prefill from your resume where we could. Add anything that is still empty.
        </p>
        <div className="resume-stage mt-10">
          <EagleMascot pose="stand" />
          <div className="resume-stage-copy">
            {draft ? <PassportForm initial={draft} /> : null}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
