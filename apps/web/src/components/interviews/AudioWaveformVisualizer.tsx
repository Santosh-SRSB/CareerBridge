'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';

/** Tunable knobs for the neon multi-layer waveform. */
export const visualizerConfig = {
  lineCount: 48,
  sensitivity: 1.65,
  noiseFloor: 0.025,
  attackSpeed: 0.28,
  releaseSpeed: 0.085,
  maxAmplitude: 1,
  baseFrequency: 2.35,
  frequencySpread: 1.8,
  glowIntensity: 20,
  lineWidth: 2.35,
  centerWidth: 0.34,
  phaseSpeed: 1.15,
  organicAmount: 0.42,
  silenceLineOpacity: 0.22,
  activeCoreOpacity: 0.95,
};

export type VisualizerConfig = typeof visualizerConfig;

type Layer = {
  ampScale: number;
  freqScale: number;
  phaseOffset: number;
  yBias: number;
  thickness: number;
  opacity: number;
  hueShift: number;
};

function buildLayers(count: number): Layer[] {
  const layers: Layer[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / Math.max(1, count - 1);
    layers.push({
      ampScale: 0.35 + t * 0.9 + Math.sin(i * 1.7) * 0.12,
      freqScale: 0.55 + t * visualizerConfig.frequencySpread + Math.cos(i * 0.9) * 0.15,
      phaseOffset: i * 0.37 + Math.sin(i * 2.1) * 0.8,
      yBias: (t - 0.5) * 10,
      thickness: visualizerConfig.lineWidth * (0.55 + (1 - Math.abs(t - 0.5) * 1.4) * 0.7),
      opacity: 0.12 + (1 - Math.abs(t - 0.5) * 1.6) * 0.55,
      hueShift: t,
    });
  }
  return layers;
}

/** Smooth deterministic organic variation (no per-frame random jitter). */
function organic(x: number, time: number, seed: number) {
  return (
    Math.sin(x * 3.1 + time * 1.3 + seed) * 0.45 +
    Math.sin(x * 7.4 - time * 0.9 + seed * 1.7) * 0.28 +
    Math.sin(x * 13.2 + time * 0.55 + seed * 0.4) * 0.12
  );
}

function envelope(nx: number, width: number) {
  // Multi-lobe envelope — denser center, soft edges (not a plain bell).
  const d = nx - 0.5;
  const g1 = Math.exp(-(d * d) / (width * width));
  const g2 = Math.exp(-((d - 0.08) * (d - 0.08)) / (width * width * 1.6));
  const g3 = Math.exp(-((d + 0.1) * (d + 0.1)) / (width * width * 2.1));
  const edge = Math.sin(Math.PI * Math.min(1, Math.max(0, nx)));
  return (g1 * 0.7 + g2 * 0.2 + g3 * 0.18) * (0.35 + edge * 0.65);
}

function strokeColor(ctx: CanvasRenderingContext2D, t: number, energy: number, w: number) {
  const g = ctx.createLinearGradient(0, 0, w, 0);
  const bright = 0.35 + energy * 0.65;
  // Blue → violet → magenta with cyan/white core influence
  g.addColorStop(0, `rgba(59, 100, 255, ${0.15 + bright * 0.25})`);
  g.addColorStop(0.25 + t * 0.05, `rgba(120, 70, 255, ${0.2 + bright * 0.35})`);
  g.addColorStop(0.5, `rgba(${180 + energy * 60}, ${200 + energy * 40}, 255, ${0.35 + bright * 0.5})`);
  g.addColorStop(0.72, `rgba(200, 80, 255, ${0.22 + bright * 0.4})`);
  g.addColorStop(1, `rgba(80, 140, 255, ${0.12 + bright * 0.2})`);
  return g;
}

/**
 * Premium multi-layer neon waveform driven by live mic amplitude (0–1).
 * Reads `amplitudeRef` inside rAF — no React re-renders per frame.
 */
export function AudioWaveformVisualizer({
  amplitudeRef,
  active = true,
  className = '',
  config = visualizerConfig,
}: {
  amplitudeRef: MutableRefObject<number>;
  active?: boolean;
  className?: string;
  config?: VisualizerConfig;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const smoothedRef = useRef(0);
  const rafRef = useRef(0);
  const layersRef = useRef<Layer[]>(buildLayers(config.lineCount));
  const startRef = useRef(performance.now());

  useEffect(() => {
    layersRef.current = buildLayers(config.lineCount);
  }, [config.lineCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let running = true;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const draw = (now: number) => {
      if (!running) return;
      rafRef.current = requestAnimationFrame(draw);

      const time = (now - startRef.current) / 1000;
      const raw = active ? Math.max(0, Math.min(1, amplitudeRef.current)) : 0;
      const gated = raw < config.noiseFloor ? 0 : raw;
      const target = Math.min(config.maxAmplitude, gated * config.sensitivity);
      const speed = target > smoothedRef.current ? config.attackSpeed : config.releaseSpeed;
      smoothedRef.current += (target - smoothedRef.current) * speed;
      if (smoothedRef.current < 0.002) smoothedRef.current = 0;

      const energy = smoothedRef.current;
      const midY = height * 0.5;

      ctx.clearRect(0, 0, width, height);

      // Subtle center spine
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = energy > 0.02 ? `rgba(180, 220, 255, ${0.18 + energy * 0.35})` : 'rgba(120, 150, 200, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width * 0.04, midY);
      ctx.lineTo(width * 0.96, midY);
      ctx.stroke();
      ctx.restore();

      if (energy < 0.008) {
        // Near-flat calm state — tiny glow only
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(100, 140, 255, 0.35)';
        ctx.strokeStyle = `rgba(140, 170, 255, ${config.silenceLineOpacity})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(width * 0.06, midY);
        ctx.lineTo(width * 0.94, midY);
        ctx.stroke();
        ctx.restore();
        return;
      }

      const maxH = height * 0.42;
      const layers = layersRef.current;
      const samples = Math.max(120, Math.floor(width / 3));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Soft bloom pass
      ctx.shadowBlur = config.glowIntensity * (0.45 + energy * 0.9);
      ctx.shadowColor = `rgba(120, 80, 255, ${0.25 + energy * 0.45})`;

      for (let li = 0; li < layers.length; li += 1) {
        const layer = layers[li];
        const amp = energy * maxH * layer.ampScale;
        if (amp < 0.4) continue;

        ctx.strokeStyle = strokeColor(ctx, layer.hueShift, energy, width);
        ctx.globalAlpha = Math.min(1, layer.opacity * (0.4 + energy * 0.9));
        ctx.lineWidth = layer.thickness;
        ctx.beginPath();

        for (let s = 0; s <= samples; s += 1) {
          const nx = s / samples;
          const x = nx * width;
          const env = envelope(nx, config.centerWidth);
          const phase =
            nx * Math.PI * 2 * config.baseFrequency * layer.freqScale +
            layer.phaseOffset +
            time * config.phaseSpeed * (0.7 + layer.freqScale * 0.3);
          const org = organic(nx * 8, time, layer.phaseOffset) * config.organicAmount;
          const y =
            midY +
            layer.yBias * energy +
            amp * env * (Math.sin(phase) * 0.72 + Math.sin(phase * 1.7 + 0.4) * 0.22 + org * 0.35);

          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Bright cyan/white core highlight
      ctx.shadowBlur = config.glowIntensity * 1.4;
      ctx.shadowColor = `rgba(200, 240, 255, ${0.35 + energy * 0.5})`;
      ctx.strokeStyle = `rgba(240, 250, 255, ${config.activeCoreOpacity * (0.35 + energy * 0.65)})`;
      ctx.lineWidth = 2.4;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      for (let s = 0; s <= samples; s += 1) {
        const nx = s / samples;
        const x = nx * width;
        const env = envelope(nx, config.centerWidth * 0.92);
        const phase =
          nx * Math.PI * 2 * config.baseFrequency * 0.95 + time * config.phaseSpeed * 0.85;
        const y =
          midY +
          energy *
            maxH *
            0.55 *
            env *
            (Math.sin(phase) * 0.8 + organic(nx * 6, time, 0.2) * 0.2);
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [active, amplitudeRef, config]);

  return (
    <div ref={wrapRef} className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
    </div>
  );
}
