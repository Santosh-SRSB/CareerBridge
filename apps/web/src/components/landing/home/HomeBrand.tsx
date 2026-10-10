import Image from "next/image";
import Link from "next/link";
import { BRAND_LOGO_HEIGHT, BRAND_LOGO_SRC, BRAND_LOGO_WIDTH, BRAND_NAME } from "@/components/brand/BrandLogo";

type HomeBrandProps = {
  href: string;
  priority?: boolean;
  className?: string;
};

export function HomeBrand({ href, priority = false, className = "" }: HomeBrandProps) {
  return (
    <Link href={href} className={`hl-brand ${className}`.trim()} aria-label="SRSB CareerBridge home">
      <Image
        src={BRAND_LOGO_SRC}
        alt=""
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        className="hl-brand__logo"
        priority={priority}
      />
      <span className="hl-brand__name">{BRAND_NAME}</span>
    </Link>
  );
}
