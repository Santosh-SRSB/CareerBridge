'use client';

import Link from 'next/link';
import { HeadsetIcon } from '@/components/landing/home/icons';

/** Floating support entry on marketing surfaces. */
export function SupportFab() {
  return (
    <Link href="/support" className="hl-support" aria-label="Open support">
      <HeadsetIcon size={24} />
    </Link>
  );
}
