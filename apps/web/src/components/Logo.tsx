import { BRAND_LOGO_SRC, BrandLogo } from "@/components/brand/BrandLogo";

/** Canonical SRSB mark used across CareerBridge. */
export const SRSB_LOGO_SRC = BRAND_LOGO_SRC;

export function Logo({
  inverted = false,
  href = "/",
  className = "",
}: {
  inverted?: boolean;
  href?: string;
  className?: string;
}) {
  return <BrandLogo href={href} tone={inverted ? "dark" : "light"} className={className} priority />;
}
