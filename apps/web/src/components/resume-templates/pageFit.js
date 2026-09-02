import { useLayoutEffect, useState } from "react";

/** A4 at 96dpi — matches the existing preview-sheet size. */
export const RESUME_PAGE = {
  width: 794,
  height: 1123,
};

export const DENSITY_LEVELS = ["normal", "compact", "tight", "min"];

export function pickDensityLevel(heights, pageHeight = RESUME_PAGE.height) {
  for (const level of DENSITY_LEVELS) {
    const height = heights[level];
    if (typeof height === "number" && height <= pageHeight + 1) {
      return { density: level, overfull: false };
    }
  }
  return { density: "min", overfull: true };
}

export function usePreviewScale(paneRef, enabled = true) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const pane = paneRef.current;
    if (!pane) return undefined;

    const update = () => {
      const styles = window.getComputedStyle(pane);
      const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
      const available = Math.max(160, pane.clientWidth - padX);
      const next = Math.min(1, available / RESUME_PAGE.width);
      setScale((current) => (Math.abs(current - next) < 0.004 ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(pane);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [paneRef, enabled]);

  return scale;
}

export function useResumePageFit(sheetRef, deps) {
  const [density, setDensity] = useState("normal");
  const [overfull, setOverfull] = useState(false);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;

    let observer;
    const apply = () => {
      const resume = sheet.querySelector(".resume");
      if (!resume) return;
      if (observer) observer.disconnect();
      const heights = {};
      for (const level of DENSITY_LEVELS) {
        sheet.dataset.density = level;
        void resume.offsetHeight;
        heights[level] = resume.scrollHeight;
      }
      const { density: chosen, overfull: overflow } = pickDensityLevel(heights);
      sheet.dataset.density = chosen;
      sheet.classList.toggle("resume-fitted", !overflow);
      sheet.classList.toggle("resume-overfull", overflow);
      setDensity((current) => (current === chosen ? current : chosen));
      setOverfull((current) => (current === overflow ? current : overflow));
      if (observer) observer.observe(resume);
    };

    apply();
    const resume = sheet.querySelector(".resume");
    if (!resume || typeof ResizeObserver === "undefined") return undefined;
    observer = new ResizeObserver(() => apply());
    observer.observe(resume);
    return () => {
      if (observer) observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { density, overfull };
}
