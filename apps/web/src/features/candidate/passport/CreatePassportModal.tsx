"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EagleMascot } from "@/features/candidate/passport/EagleMascot";

export function CreatePassportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pose, setPose] = useState<"fly" | "stand">("fly");

  useEffect(() => {
    const id = window.setTimeout(() => setPose("stand"), 1150);
    return () => window.clearTimeout(id);
  }, []);

  if (!open) return null;

  return (
    <div className="passport-modal" role="dialog" aria-modal="true" aria-labelledby="passport-choice-title">
      <button className="passport-modal-scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="passport-modal-card">
        <EagleMascot pose={pose} />
        <div className="passport-modal-copy">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">Career Passport</p>
          <h2 id="passport-choice-title" className="font-display mt-2 text-2xl font-extrabold text-navy">
            How do you want to start?
          </h2>
          <p className="mt-2 text-sm text-muted">
            Use a resume we can read, or build your passport yourself. You can fill any missing field later.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="passport-choice"
              onClick={() => {
                onClose();
                router.push("/passport/create/resume");
              }}
            >
              <span className="passport-choice-title">Create with resume</span>
              <span className="passport-choice-sub">Drop your file. We fetch education, skills and about.</span>
            </button>
            <button
              type="button"
              className="passport-choice"
              onClick={() => {
                onClose();
                router.push("/passport/create/build");
              }}
            >
              <span className="passport-choice-title">Create without resume</span>
              <span className="passport-choice-sub">Build your resume on the passport, field by field.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
