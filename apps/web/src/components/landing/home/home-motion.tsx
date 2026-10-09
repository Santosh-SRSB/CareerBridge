"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

/** `inView` follows the viewport (pauses auto-play); `revealed` latches once for entrance motion. */
export function useInView<T extends Element>(ref: RefObject<T | null>, threshold: number) {
  const [state, setState] = useState({ inView: false, revealed: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setState((prev) => ({
          inView: entry.isIntersecting,
          revealed: prev.revealed || entry.isIntersecting,
        }));
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);

  return state;
}

/** Inline width for the animated progress bars in the illustrative previews. */
export function barWidth(percent: number): CSSProperties {
  return { "--w": `${percent}%` } as CSSProperties;
}

export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current?.firstChild;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1000);
      node.nodeValue = `${Math.round(value * (1 - (1 - t) ** 3))}${suffix}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.nodeValue = `${value}${suffix}`;
    };
  }, [value, suffix]);

  return <span ref={ref}>{`${value}${suffix}`}</span>;
}
