import Image from 'next/image';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_PX: Record<Size, number> = {
  xs: 36,
  sm: 48,
  md: 72,
  lg: 104,
  xl: 140,
};

export function InterviewBotFace({
  size = 'md',
  className = '',
  speaking = false,
  alt = 'AI interviewer',
}: {
  size?: Size;
  className?: string;
  speaking?: boolean;
  alt?: string;
}) {
  const px = SIZE_PX[size];
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center ${speaking ? 'animate-pulse' : ''} ${className}`}
      style={{ width: px, height: px }}
    >
      <Image
        src="/illustrations/ai-interview-bot.png"
        alt={alt}
        width={px}
        height={px}
        className="h-full w-full object-contain drop-shadow-sm"
        priority={size === 'lg' || size === 'xl'}
      />
    </span>
  );
}
