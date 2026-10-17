import Link from "next/link";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { HomeBrand } from "./HomeBrand";
import { ArrowRightIcon, FacebookIcon, InstagramIcon, LinkedInIcon, MailIcon } from "./icons";

type Audience = "candidate" | "employer";

const WELCOME_PATH: Record<Audience, string> = {
  candidate: "/welcome",
  employer: "/employer/welcome",
};

type FooterLink = { href: string; label: string; featuresOf?: Audience };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Candidate",
    links: [
      { href: "/login?role=candidate", label: "Candidate Login" },
      { href: "/welcome#features", label: "Candidate Features", featuresOf: "candidate" },
    ],
  },
  {
    title: "Employer",
    links: [
      { href: "/login?role=employer", label: "Employer Login" },
      { href: "/employer/welcome", label: "Employer Features", featuresOf: "employer" },
    ],
  },
  {
    title: "Links",
    links: [
      { href: "/support", label: "Support" },
      { href: "/privacy", label: "Privacy and Policy" },
      { href: "/terms", label: "Terms and Conditions" },
    ],
  },
];

const SOCIALS = [
  { href: SOCIAL_LINKS.facebook, label: "Facebook", Icon: FacebookIcon, external: true },
  { href: SOCIAL_LINKS.instagram, label: "Instagram", Icon: InstagramIcon, external: true },
  { href: SOCIAL_LINKS.linkedin, label: "LinkedIn", Icon: LinkedInIcon, external: true },
  { href: SOCIAL_LINKS.email, label: "Email SRSB", Icon: MailIcon, external: false },
];

function linkHref(link: FooterLink, welcome?: Audience) {
  if (!welcome || !link.featuresOf) return link.href;
  return link.featuresOf === welcome ? "#features" : `${WELCOME_PATH[link.featuresOf]}#features`;
}

/**
 * `welcome` is set on the audience welcome pages: they carry their own call to action, so the
 * CTA band is dropped and the features links point at each page's #features section.
 */
export function HomeFooter({ welcome }: { welcome?: Audience } = {}) {
  return (
    <footer className="hl-footer">
      {welcome ? null : (
        <div className="hl-footer__cta">
          <svg
            className="hl-footer__deco"
            viewBox="0 0 520 520"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="260" cy="260" r="80" strokeWidth="2" />
            <circle cx="260" cy="260" r="140" strokeWidth="2" strokeDasharray="4 10" />
            <circle cx="260" cy="260" r="200" strokeWidth="2" />
            <circle cx="260" cy="60" r="7" fill="currentColor" stroke="none" />
          </svg>
          <div className="hl-footer__inner">
            <h2 className="hl-footer__title">Let&apos;s make the next move together.</h2>
            <Link href="/login" className="hl-pill hl-pill--primary">
              Get Started
              <span className="hl-pill__arrow">
                <ArrowRightIcon size={18} />
              </span>
            </Link>
          </div>
        </div>
      )}

      <div className="hl-footer__body">
        <div className="hl-footer__inner">
          <div className="hl-footer__grid">
            <div className="hl-footer__brand">
              <HomeBrand href="/" />
              <p>We connect talent with opportunity.</p>
            </div>
            {COLUMNS.map((column) => (
              <nav key={column.title} className="hl-footer__col" aria-label={column.title}>
                <h3>{column.title}</h3>
                <ul>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={linkHref(link, welcome)}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          <div className="hl-footer__bottom">
            <ul className="hl-footer__socials">
              {SOCIALS.map(({ href, label, Icon, external }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={label}
                    {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    <Icon size={20} />
                  </a>
                </li>
              ))}
            </ul>
            <p className="hl-footer__copy">
              © {new Date().getFullYear()} CareerBridge. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
