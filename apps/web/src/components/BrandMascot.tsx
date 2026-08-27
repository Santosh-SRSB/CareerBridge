'use client';

/** Cache-bust when mascot PNGs are regenerated */
const V = 'v18';

const ASSETS = {
  run: { src: `/mascots/eagle-run.png?${V}`, alt: 'SRSB eagle running forward', w: 480, h: 480 },
  checklist: {
    src: `/mascots/eagle-checklist.png?${V}`,
    alt: 'SRSB eagle with completed checklist',
    w: 480,
    h: 480,
  },
  laptop: {
    src: `/mascots/eagle-laptop.png?${V}`,
    alt: 'SRSB eagle working on a laptop',
    w: 480,
    h: 480,
  },
  tablet: {
    src: `/mascots/eagle-tablet.png?${V}`,
    alt: 'SRSB eagle with tablet and headphones',
    w: 480,
    h: 480,
  },
  book: {
    src: `/mascots/eagle-book.png?${V}`,
    alt: 'SRSB eagle reading a book',
    w: 480,
    h: 480,
  },
  target: { src: `/mascots/target-hit.png?${V}`, alt: 'Target with bullseye hit', w: 420, h: 420 },
  briefcase: {
    src: `/mascots/briefcase.png?${V}`,
    alt: 'Briefcase icon',
    w: 420,
    h: 420,
  },
} as const;

export type BrandMascotPose = keyof typeof ASSETS;
export type BrandMascotMotion = 'float' | 'run' | 'pop' | 'pulse' | 'none';

export function BrandMascot({
  pose,
  motion = 'float',
  size = 'md',
  className = '',
  priority = false,
}: {
  pose: BrandMascotPose;
  motion?: BrandMascotMotion;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  priority?: boolean;
}) {
  const asset = ASSETS[pose];
  const sizeClass =
    size === 'sm' ? 'cb-mascot--sm' : size === 'lg' ? 'cb-mascot--lg' : 'cb-mascot--md';
  const motionClass = motion === 'none' ? '' : `cb-mascot--${motion}`;

  return (
    <div
      className={`cb-mascot ${sizeClass} ${motionClass} ${className}`.trim()}
      style={{ background: 'transparent' }}
    >
      {/* Native img keeps PNG alpha reliably (no black plate behind mascot) */}
      <img
        src={asset.src}
        alt={asset.alt}
        width={asset.w}
        height={asset.h}
        className="cb-mascot__img"
        decoding="async"
        loading={priority ? 'eager' : 'lazy'}
        style={{ backgroundColor: 'transparent', background: 'transparent' }}
      />
    </div>
  );
}
