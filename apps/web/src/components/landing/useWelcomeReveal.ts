'use client';

import { useEffect } from 'react';

/** Adds `is-revealed` to each `.wl-observe` block as it scrolls in, which fades in its `.hl-reveal` children. */
export function useWelcomeReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.wl-observe');
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.2 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
