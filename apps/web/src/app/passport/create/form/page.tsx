"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { PassportForm } from "@/features/candidate/passport/PassportForm";
import { EagleMascot } from "@/features/candidate/passport/EagleMascot";
import { DRAFT_KEY, EMPTY_DRAFT, type PassportDraft } from "@/types/passport";

export default function PassportFormPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<PassportDraft | null>(null);
  const [fromResume, setFromResume] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const manual = params.get("source") === "manual";
    if (manual) {
      sessionStorage.removeItem(DRAFT_KEY);
      setFromResume(false);
      setDraft({ ...EMPTY_DRAFT, source: "manual" });
      return;
    }
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (raw) {
      setFromResume(true);
      setDraft(JSON.parse(raw) as PassportDraft);
      return;
    }
    // No draft and not manual — send to start choices via dashboard gate
    setFromResume(false);
    setDraft({ ...EMPTY_DRAFT, source: "manual" });
  }, [router]);

  return (
    <div className="min-h-full bg-fog">
      <Navbar landingLinks={false} />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">
          Career Passport
        </p>
        <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">
          {fromResume ? "Review your details" : "Start your Career Passport"}
        </h1>
        <p className="mt-3 text-sm text-muted">
          {fromResume
            ? "We prefilled what we could from your resume. Fix anything missing, then continue."
            : "Fill this first form. Next you’ll preview your resume, complete your passport, and save it — same steps as the with-resume path."}
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
