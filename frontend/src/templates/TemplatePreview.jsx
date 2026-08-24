import React, { useEffect, useRef, useState } from "react";
import { getTemplateComponent } from "./index.js";
import { SAMPLE_RESUME } from "./sampleData.js";

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;

export default function TemplatePreview({ id }) {
  const wrapRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(0.28);
  const [pageHeight, setPageHeight] = useState(PAGE_HEIGHT);
  const TemplateComponent = getTemplateComponent(id);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const update = () => {
      const width = el.clientWidth || 220;
      setScale(width / PAGE_WIDTH);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    const measure = () => {
      const resume = inner.querySelector(".resume");
      const height = resume ? Math.max(PAGE_HEIGHT, resume.scrollHeight) : PAGE_HEIGHT;
      setPageHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [id]);

  return (
    <div
      ref={wrapRef}
      className="template-live-preview"
      style={{ aspectRatio: `${PAGE_WIDTH} / ${pageHeight}` }}
    >
      <div
        ref={innerRef}
        className="template-live-preview-inner"
        style={{
          width: PAGE_WIDTH,
          height: pageHeight,
          transform: `scale(${scale})`,
        }}
      >
        <TemplateComponent data={SAMPLE_RESUME} />
      </div>
    </div>
  );
}
