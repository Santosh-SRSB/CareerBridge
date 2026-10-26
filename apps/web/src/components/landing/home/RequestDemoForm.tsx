"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { requestDemo } from "@/lib/api";
import { SUPPORT_EMAIL } from "@/lib/social-links";
import { CloseIcon } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RequestDemoForm({ open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setName("");
    setCompanyName("");
    setWorkEmail("");
    setPhone("");
    setMessage("");
    setError("");
    setDone(false);
    setLoading(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, close]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestDemo({
        name: name.trim(),
        companyName: companyName.trim(),
        workEmail: workEmail.trim(),
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="hl-demo-popup" role="presentation" onClick={close}>
      <div
        className="hl-demo-popup__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="hl-demo-popup__close" aria-label="Close" onClick={close}>
          <CloseIcon size={18} />
        </button>
        <h2 id={titleId} className="hl-demo-popup__title">
          Request for Demo
        </h2>
        <p className="hl-demo-popup__lede">
          See how CareerBridge works for employers before you register. We will reach you shortly.
        </p>
        {done ? (
          <div className="hl-demo-popup__done">
            <p>Thanks — your demo request was sent to CareerBridge support.</p>
            <button type="button" className="hl-pill hl-pill--primary" onClick={close}>
              Close
            </button>
          </div>
        ) : (
          <form className="hl-demo-popup__form" onSubmit={onSubmit}>
            <label>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="name" />
            </label>
            <label>
              Company name
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                minLength={2}
                maxLength={160}
                autoComplete="organization"
              />
            </label>
            <label>
              Work email
              <input
                type="email"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                required
                maxLength={160}
                autoComplete="email"
              />
            </label>
            <label>
              Phone <span>(optional)</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} autoComplete="tel" />
            </label>
            <label>
              Message <span>(optional)</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={3} />
            </label>
            {error ? <p className="hl-demo-popup__error">{error}</p> : null}
            <button type="submit" className="hl-pill hl-pill--primary" disabled={loading}>
              {loading ? "Sending…" : "Send request"}
            </button>
            <p className="hl-demo-popup__hint">
              Or email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
