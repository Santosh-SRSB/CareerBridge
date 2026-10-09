import Image from "next/image";
import Link from "next/link";

type HomeBrandProps = {
  href: string;
  priority?: boolean;
  className?: string;
};

export function HomeBrand({ href, priority = false, className = "" }: HomeBrandProps) {
  return (
    <Link href={href} className={`hl-brand ${className}`.trim()} aria-label="SRSB CareerBridge home">
      <Image
        src="/srsb-mark.png"
        alt=""
        width={263}
        height={110}
        className="hl-brand__logo"
        priority={priority}
      />
      <span className="hl-brand__name">CareerBridge</span>
    </Link>
  );
}
