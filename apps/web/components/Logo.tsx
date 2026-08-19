import Link from 'next/link';

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-orange to-teal text-lg font-extrabold text-white shadow-[0_4px_10px_rgba(0,0,0,0.25)]">
        C
      </span>
      <span className={`text-lg font-extrabold tracking-tight ${inverted ? 'text-white' : 'text-primary'}`}>
        CareerBridge
      </span>
    </Link>
  );
}
