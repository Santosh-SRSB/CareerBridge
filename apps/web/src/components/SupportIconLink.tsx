import Link from 'next/link';
import { HeadsetIcon } from '@/components/landing/home/icons';

export const SUPPORT_PATH = '/support';

/** Icon-only entry to the Support page for portal headers. */
export function SupportIconLink({
  className = '',
  iconSize = 20,
  onClick,
}: {
  className?: string;
  iconSize?: number;
  onClick?: () => void;
}) {
  return (
    <Link href={SUPPORT_PATH} className={className} aria-label="Support" title="Support" onClick={onClick}>
      <HeadsetIcon size={iconSize} />
    </Link>
  );
}
