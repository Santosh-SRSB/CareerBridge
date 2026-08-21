"use client";

import { useEffect, useRef, useState } from "react";
import { DRAFT_KEY, EMPTY_DRAFT, type PassportDraft } from "@/types/passport";
import { PassportForm } from "@/features/candidate/passport/PassportForm";
import { EagleMascot } from "@/features/candidate/passport/EagleMascot";

const SLIDES = [
  { key: "drop", label: "Drop resume" },
  { key: "education", label: "Fetching education details" },
  { key: "skills", label: "Fetching skills" },
  { key: "experience", label: "Fetching experience" },
  { key: "interests", label: "Fetching career interest" },
  { key: "form", label: "Complete missing details" },
] as const;

const FETCH_MS = 1250;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function parseResumeFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/v1/candidates/resume/parse", {
    method: "POST",
    body: form,
  });
  const raw = await response.text();
  let json: { success?: boolean; data?: PassportDraft; error?: { message?: string } } = {};
  try {
    json = raw ? (JSON.parse(raw) as typeof json) : {};
  } catch {
    throw new Error("Could not read resume. Please try again.");
  }
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error?.message ?? "Could not read resume");
  }
  return json.data;
}

export function ResumeCreateFlow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickStarted = useRef(0);
  const [slide, setSlide] = useState(0);
  const [draft, setDraft] = useState<PassportDraft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!picking) return;
    const onFocus = () => {
      if (Date.now() - pickStarted.current < 450) return;
      setPicking(false);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [picking]);

  const openPicker = () => {
    if (busy || picking) return;
    setPicking(true);
    pickStarted.current = Date.now();
    window.setTimeout(() => inputRef.current?.click(), 400);
  };

  const onFile = async (file: File) => {
    setError("");
    setBusy(true);
    setSlide(1);

    try {
      const [data] = await Promise.all([
        parseResumeFile(file),
        (async () => {
          for (let index = 1; index <= 4; index += 1) {
            setSlide(index);
            await wait(FETCH_MS);
          }
        })(),
      ]);
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      setDraft(data);
      setSlide(5);
    } catch (err) {
      setSlide(0);
      setError(err instanceof Error ? err.message : "Could not read resume");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="resume-slider">
      <div className="resume-slider-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
        <section className="resume-slide" aria-hidden={slide !== 0}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">Create with resume</p>
          <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">Drop your resume</h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            We fetch what we can, then you complete name, education, skills and experience.
          </p>
          <div className="resume-point mt-10">
            <EagleMascot pose="point" />
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.doc,.docx,.txt"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPicking(false);
                event.target.value = "";
                if (file) void onFile(file);
              }}
            />
            <button
              type="button"
              className={`resume-drop-tip${drag ? " is-drag" : ""}${picking ? " is-picking" : ""}`}
              disabled={busy}
              onClick={openPicker}
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
              {picking ? (
                <>
                  <span className="resume-drop-tip-title">Loading</span>
                  <span className="drop-loading-dots drop-loading-dots-on-dark" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                </>
              ) : (
                <>
                  <span className="resume-drop-tip-title">Drop resume</span>
                  <span className="resume-drop-tip-sub">PDF, Word or text</span>
                </>
              )}
            </button>
            {error ? <p className="resume-point-error">{error}</p> : null}
          </div>
        </section>

        {SLIDES.slice(1, 5).map((item, index) => {
          const step = index + 1;
          const live = slide === step;
          return (
            <section
              key={item.key}
              className={`resume-slide resume-slide-fetch${live ? " is-live" : ""}`}
              aria-hidden={!live}
            >
              <div className="fetch-scene">
                <span className="fetch-ring" />
                <span className="fetch-ring fetch-ring-delay" />
                <span className="fetch-scan" />
                <span className="fetch-doc fetch-doc-1" />
                <span className="fetch-doc fetch-doc-2" />
                <span className="fetch-doc fetch-doc-3" />
                <EagleMascot pose="fetch" />
              </div>
              <p key={item.key + String(live)} className="fetch-slide-label">
                {item.label}
                <span className="fetch-dots-text" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </p>
              <div className="fetch-bar" aria-hidden="true">
                <span />
              </div>
            </section>
          );
        })}

        <section className="resume-slide" aria-hidden={slide !== 5}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">Career Passport</p>
          <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">Complete what is missing</h1>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Add or correct first name, last name, highest education, skills and experience.
          </p>
          <div className="resume-stage mt-8">
            <EagleMascot pose="stand" />
            <div className="resume-stage-copy">
              {slide === 5 ? <PassportForm initial={draft} /> : null}
            </div>
          </div>
        </section>
      </div>

      <div className="resume-dots" role="tablist" aria-label="Resume steps">
        {SLIDES.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            className={`resume-dot${index === slide ? " is-active" : ""}`}
            aria-label={item.label}
            aria-current={index === slide ? "step" : undefined}
            disabled={busy && index !== slide}
            onClick={() => {
              if (!busy && (index === 0 || slide === 5)) setSlide(index === 0 ? 0 : 5);
            }}
          />
        ))}
      </div>
    </div>
  );
}
