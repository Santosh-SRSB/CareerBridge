"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getStoredUser } from "@/lib/session";
import { CloseIcon } from "./icons";

const STORAGE_KEY = "cb.launchOfferPopup";
const BANNER_SRC = "/landing/launch-offer-30-days.png";
const BANNER_WIDTH = 1851;
const BANNER_HEIGHT = 1158;

function readSeen() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // sessionStorage may be unavailable (private mode, disabled storage)
  }
}

/** Survives React Strict Mode remounts in the same page load. */
let visibleThisRuntime = false;

export function LaunchOfferPopup() {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    writeSeen();
    visibleThisRuntime = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    const shouldOpen = visibleThisRuntime || (!getStoredUser()?.id && !readSeen());
    if (!shouldOpen) return;
    if (!visibleThisRuntime) {
      visibleThisRuntime = true;
      writeSeen();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is client-only; shown once after hydration
    setOpen(true);
  }, []);

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

  if (!open) return null;

  return createPortal(
    <div className="hl-launch-popup">
      <button
        type="button"
        className="hl-launch-popup__backdrop"
        aria-label="Dismiss launch offer"
        onClick={close}
      />
      <div
        className="hl-launch-popup__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="sr-only">
          Launch offer: 30 days free for candidates and employers
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="hl-launch-popup__close"
          aria-label="Close launch offer"
          onClick={close}
        >
          <CloseIcon size={18} />
        </button>
        <div className="hl-launch-popup__media">
          <Image
            src={BANNER_SRC}
            alt="Launch offer: CareerBridge is free for candidates and employers for 30 days"
            width={BANNER_WIDTH}
            height={BANNER_HEIGHT}
            className="hl-launch-popup__image"
            sizes="(max-width: 600px) calc(100vw - 32px), 560px"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
