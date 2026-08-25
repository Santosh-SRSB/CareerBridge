'use client';

import { useEffect, useRef } from 'react';
import { subscribeAiSpeech } from './ai-speech';

const ORB = '/interviews/ai-orb.png';

export default function LiveInterviewer({
  listening = false,
  thinking = false,
}: {
  listening?: boolean;
  thinking?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const listeningRef = useRef(listening);
  const thinkingRef = useRef(thinking);
  listeningRef.current = listening;
  thinkingRef.current = thinking;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!host || !canvas || !ctx) return;

    let disposed = false;
    let frame = 0;
    let speaking = false;
    const started = performance.now();
    const orb = new Image();
    orb.decoding = 'async';
    orb.src = ORB;

    const unsub = subscribeAiSpeech((next) => {
      speaking = next.speaking;
    });

    const fit = () => {
      const size = Math.min(host.clientWidth || 420, host.clientHeight || 420, 520);
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size * ratio);
      canvas.height = Math.floor(size * ratio);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);

    const drawWave = (
      cx: number,
      cy: number,
      radius: number,
      t: number,
      amp: number,
      color: string,
      phase: number,
      thickness: number,
    ) => {
      ctx.beginPath();
      const steps = 80;
      for (let i = 0; i <= steps; i += 1) {
        const n = i / steps;
        const x = cx - radius * 0.72 + radius * 1.44 * n;
        const y =
          cy +
          Math.sin(n * Math.PI * 4 + t * 4 + phase) * amp * 0.5 +
          Math.sin(n * Math.PI * 7 + t * 5.5 + phase) * amp * 0.35;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.stroke();
    };

    const draw = (now: number) => {
      if (disposed) return;
      frame = window.requestAnimationFrame(draw);
      const size = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
      const t = (now - started) / 1000;
      const talk = speaking;
      const think = thinkingRef.current;
      const listen = listeningRef.current && !talk && !think;
      const energy = talk ? 1 : listen ? 0.7 : think ? 0.45 : 0.25;
      const pulse = 1 + Math.sin(t * (talk ? 6 : 2.5)) * (talk ? 0.04 : 0.015);

      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const radius = size * 0.38 * pulse;

      // Glow only around the ball — no square fill
      if (talk || listen) {
        const glow = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius * 1.35);
        glow.addColorStop(0, talk ? 'rgba(45, 212, 191, 0.35)' : 'rgba(129, 140, 248, 0.22)');
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
        ctx.fill();
      }

      // Orb — circular clip so no square PNG edges
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      if (orb.complete && orb.naturalWidth) {
        const s = radius * 2.15;
        ctx.drawImage(orb, cx - s / 2, cy - s / 2, s, s);
      } else {
        ctx.fillStyle = '#1e1b4b';
        ctx.fill();
      }

      const amp = radius * (0.08 + energy * 0.24);
      drawWave(cx, cy - radius * 0.08, radius, t, amp, `rgba(34, 211, 238, ${0.5 + energy * 0.4})`, 0, talk ? 3 : 2);
      drawWave(cx, cy, radius, t * 1.1, amp * 0.85, `rgba(232, 121, 249, ${0.4 + energy * 0.35})`, 1.2, talk ? 2.5 : 1.6);
      drawWave(cx, cy + radius * 0.08, radius, t * 0.95, amp * 0.7, `rgba(165, 243, 252, ${0.35 + energy * 0.3})`, 2, talk ? 2 : 1.4);

      if (talk) {
        for (let i = 0; i < 16; i += 1) {
          const a = (i / 16) * Math.PI * 2 + t * 2.8;
          const r = radius * (0.2 + ((Math.sin(t * 7 + i) + 1) / 2) * 0.4);
          ctx.fillStyle = i % 2 === 0 ? 'rgba(34,211,238,0.6)' : 'rgba(232,121,249,0.5)';
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.5, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Soft ring when speaking
      if (talk || listen) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius * (1.02 + Math.sin(t * 7) * 0.015), 0, Math.PI * 2);
        ctx.strokeStyle = talk ? 'rgba(94, 234, 211, 0.6)' : 'rgba(129, 140, 248, 0.4)';
        ctx.lineWidth = talk ? 2.5 : 1.5;
        ctx.stroke();
      }
    };
    frame = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      unsub();
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={hostRef} className="ai-world-orb-float">
      <canvas ref={canvasRef} className="ai-world-orb-canvas" />
    </div>
  );
}
