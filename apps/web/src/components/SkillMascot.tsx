'use client';

const SRC = {
  coach: '/brand/mascot-coach.png?v=2',
  guide: '/brand/mascot-guide.png?v=2',
  graduate: '/brand/mascot-graduate.png?v=2',
  idea: '/brand/mascot-idea.png?v=2',
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
