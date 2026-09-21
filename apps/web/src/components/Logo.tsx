import Image from "next/image";
import Link from "next/link";

/** Canonical SRSB mark used across CareerBridge (candidate dashboard logo). */
export const SRSB_LOGO_SRC = "/srsb-mark.png";

export function Logo({
  inverted = false,
  href = "/",
  className = "",
}: {
  inverted?: boolean;
  href?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <Image
        src={SRSB_LOGO_SRC}
        alt="SRSB CareerBridge"
        width={88}
        height={88}
        className={`h-10 w-10 object-contain sm:h-11 sm:w-11 ${inverted ? "brightness-0 invert" : ""}`}
        unoptimized
        priority
      />
    </Link>
  );
}
