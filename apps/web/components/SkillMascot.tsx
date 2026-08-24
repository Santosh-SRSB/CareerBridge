'use client';

const SRC = {
  coach: '/brand/mascot-coach-live.png?v=5',
  guide: '/brand/mascot-guide-live.png?v=5',
  graduate: '/brand/mascot-graduate-live.png?v=5',
  idea: '/brand/mascot-idea-live.png?v=5',
} as const;

export function SkillMascot({
  pose,
  className = '',
  alt = '',
}: {
  pose: keyof typeof SRC;
  className?: string;
  alt?: string;
}) {
  return <img src={SRC[pose]} alt={alt} className={`cb-arena-mascot ${className}`} draggable={false} />;
}
