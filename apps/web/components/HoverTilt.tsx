'use client';

import { type ReactNode, useEffect, useState } from 'react';

const FLAT = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0) scale(1)';

function finePointerHover() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function HoverTilt({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [style, setStyle] = useState({ transform: FLAT });

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return (
    <div
      className={`cb-hover-tilt ${className}`}
      style={enabled ? style : undefined}
      onMouseMove={
        enabled
          ? (event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = (event.clientX - rect.left) / rect.width;
              const y = (event.clientY - rect.top) / rect.height;
              const rotateY = (x - 0.5) * 14;
              const rotateX = (0.5 - y) * 10;
              setStyle({
                transform: `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(16px) scale(1.03)`,
              });
            }
          : undefined
      }
      onMouseLeave={
        enabled
          ? () => {
              setStyle({ transform: FLAT });
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
