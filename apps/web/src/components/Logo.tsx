import Image from "next/image";
import Link from "next/link";

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <Image
        src="/srsb-wordmark.png"
        alt="SRSB CareerBridge"
        width={408}
        height={170}
        className={`h-9 w-auto ${inverted ? "brightness-0 invert" : ""}`}
        unoptimized
        priority
      />
    </Link>
  );
}
