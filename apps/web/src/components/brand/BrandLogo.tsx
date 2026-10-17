import Image from 'next/image';
import Link from 'next/link';
import '@/components/brand/brand.css';

/** Official mark shown on the landing page; every portal reuses this exact asset. */
export const BRAND_LOGO_SRC = '/srsb-mark.png';
export const BRAND_LOGO_WIDTH = 408;
export const BRAND_LOGO_HEIGHT = 170;
export const BRAND_NAME = 'CareerBridge';

type BrandLogoProps = {
  /** Wraps the lockup in a link when set. */
  href?: string;
  /** Admin/Super Admin presentation: shows this label instead of the CareerBridge name. */
  role?: string;
  /** `dark` for navy surfaces, `light` for white/light surfaces. */
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  priority?: boolean;
  className?: string;
  /** Accessible name for the link; defaults to "CareerBridge home" or "CareerBridge <role>". */
  label?: string;
  onClick?: () => void;
};

export function BrandLogo({
  href,
  role,
  tone = 'light',
  size = 'md',
  priority = false,
  className = '',
  label: labelOverride,
  onClick,
}: BrandLogoProps) {
  const classes = `cb-brand cb-brand--${tone} cb-brand--${size} ${className}`.trim();
  const content = (
    <>
      <Image
        src={BRAND_LOGO_SRC}
        alt=""
        width={BRAND_LOGO_WIDTH}
        height={BRAND_LOGO_HEIGHT}
        className="cb-brand__logo"
        priority={priority}
      />
      {role ? (
        <span className="cb-brand__role">{role}</span>
      ) : (
        <span className="cb-brand__name">{BRAND_NAME}</span>
      )}
    </>
  );
  const label = labelOverride || (role ? `${BRAND_NAME} ${role}` : `${BRAND_NAME} home`);

  if (!href) {
    return (
      <span className={classes} role="img" aria-label={role ? label : BRAND_NAME}>
        {content}
      </span>
    );
  }
  return (
    <Link href={href} className={classes} aria-label={label} onClick={onClick}>
      {content}
    </Link>
  );
}
