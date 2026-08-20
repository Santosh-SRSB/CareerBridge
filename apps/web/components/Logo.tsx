import Link from 'next/link';

export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`cb-logo-3d ${className}`} aria-hidden>
      <path
        d="M28 8c-7 1-12 6-13 13 4-3 9-3 13 1 2 2 3 5 3 8"
        fill="none"
        stroke="#f15a24"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M12 32c7-1 12-6 13-13-4 3-9 3-13-1-2-2-3-5-3-8"
        fill="none"
        stroke="#1ec8c0"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <LogoMark />
      <span
        className={`cb-logo-word text-lg font-extrabold tracking-tight ${
          inverted ? 'text-white' : 'text-orange'
        }`}
      >
        CareerBridge
      </span>
    </Link>
  );
}
