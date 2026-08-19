"use client";

import { useCallback, useState } from "react";
import { DRAFT_KEY, EMPTY_DRAFT, type PassportDraft } from "@/types/passport";
import { PassportForm } from "@/features/candidate/passport/PassportForm";

const STEPS = [
  "SRSB is fetching the resume",
  "Education section done",
  "Skills section done",
  "About section done",
  "About to complete — resume fetched successfully",
];

export function ResumeCreateFlow() {
  const [phase, setPhase] = useState<"drop" | "fetch" | "form">("drop");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PassportDraft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);

  const runFetch = useCallback((data: PassportDraft) => {
    setDraft(data);
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    setPhase("fetch");
    setStep(0);
    STEPS.forEach((_, index) => {
      window.setTimeout(() => {
        setStep(index);
        if (index === STEPS.length - 1) {
          window.setTimeout(() => setPhase("form"), 900);
        }
      }, index * 850);
    });
  }, []);

  const onFile = async (file: File) => {
    setError("");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/v1/candidates/resume/parse", {
      method: "POST",
      body: form,
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      setError(json.error?.message ?? "Could not read resume");
      return;
    }
    runFetch(json.data as PassportDraft);
  };

  if (phase === "form") {
    return (
      <div>
        <p className="fetch-tag is-done mb-6">Resume fetched successfully</p>
        <PassportForm initial={draft} />
      </div>
    );
  }

  if (phase === "fetch") {
    return (
      <ol className="fetch-list">
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={`fetch-tag${index <= step ? " is-on" : ""}${
              index < step || (index === step && index === STEPS.length - 1) ? " is-done" : ""
            }`}
          >
            <span className="fetch-check">
              {index < step || (index === STEPS.length - 1 && index <= step) ? "✓" : ""}
            </span>
            {label}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <label
      className={`resume-drop${drag ? " is-drag" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDrag(false);
        const file = event.dataTransfer.files[0];
        if (file) void onFile(file);
      }}
    >
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.doc,.docx,.txt"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <p className="font-display text-xl font-extrabold text-navy">Drop resume</p>
      <p className="mt-2 text-sm text-muted">PDF, Word or text. Then SRSB fetches education, skills and about.</p>
      {error ? <p className="mt-3 text-sm font-semibold text-orange">{error}</p> : null}
    </label>
  );
}
