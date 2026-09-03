import Image from 'next/image';

type Props = {
  className?: string;
  priority?: boolean;
  alt?: string;
};

/** Shared remote-interview illustration for human mock flow (not the skill eagle). */
export function HumanInterviewArt({
  className = '',
  priority = false,
  alt = 'Candidate in a live human interview video call',
}: Props) {
  return (
    <div className={`cb-hire-art${className ? ` ${className}` : ''}`}>
      <Image
        src="/interviews/human-interview.png"
        alt={alt}
        width={640}
        height={480}
        className="cb-hire-art-img"
        priority={priority}
        unoptimized
      />
    </div>
  );
}
