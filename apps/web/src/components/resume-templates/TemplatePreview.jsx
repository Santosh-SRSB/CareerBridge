import React, { useEffect, useRef, useState } from "react";
import { getTemplateComponent } from "./index.js";
import { SAMPLE_RESUME } from "./sampleData.js";
import { RESUME_PAGE } from "./pageFit.js";

const PAGE_WIDTH = RESUME_PAGE.width;
const PAGE_HEIGHT = RESUME_PAGE.height;

export default function TemplatePreview({ id }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const TemplateComponent = getTemplateComponent(id);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const update = () => {
      const width = el.clientWidth || 0;
      const height = el.clientHeight || 0;
      if (width < 8 || height < 8) return;
      const next = Math.min(width / PAGE_WIDTH, height / PAGE_HEIGHT);
      setScale(next > 0 ? next : 0.5);
    };

    update();
    // Re-measure after layout settles (modal open / CSS apply).
    const raf = window.requestAnimationFrame(update);
    const t1 = window.setTimeout(update, 50);
    const t2 = window.setTimeout(update, 200);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      observer.disconnect();
    };
  }, [id]);

  return (
    <div ref={wrapRef} className="template-live-preview">
      <div
        ref={innerRef}
        className="template-live-preview-inner"
        style={{
          width: PAGE_WIDTH,
          height: PAGE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <TemplateComponent data={SAMPLE_RESUME} />
      </div>
    </div>
  );
}
