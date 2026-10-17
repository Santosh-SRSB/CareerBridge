import Image from "next/image";
import Link from "next/link";
import { HeroPassportCards } from "./HeroPassportCards";
import { HomeNavbar } from "./HomeNavbar";
import { ArrowRightIcon, BriefcaseIcon } from "./icons";

export function HomeHero() {
  return (
    <header className="hl-hero">
      <div className="hl-hero__panel" aria-hidden="true" />
      <HomeNavbar />

      <div className="hl-hero__inner">
        <div className="hl-hero__copy">
          <p className="hl-cap">
            <BriefcaseIcon size={16} strokeWidth={2.2} />
            Jobs &amp; Careers
          </p>
          <h1 className="hl-hero__title">
            At <span className="hl-hero__highlight">CareerBridge</span>, we connect talent with
            opportunity.
          </h1>
          <p className="hl-hero__lede">
            We help candidates discover the right opportunities and employers find the right
            talent.
          </p>
        </div>

        <div className="hl-hero__ctas">
          <Link href="/register?role=candidate" className="hl-btn hl-btn--primary hl-btn--lg">
            Create Free Profile
          </Link>
          <Link href="/jobs" className="hl-btn hl-btn--ghost hl-btn--lg hl-btn--on-white">
            Find Jobs
          </Link>
        </div>

        <div className="hl-hero__visual">
          <Image
            src="/landing/hero-professional.webp"
            alt="Smiling professional pointing at a laptop"
            width={640}
            height={718}
            className="hl-hero__cutout"
            priority
          />
          <p className="hl-cap hl-cap--float">
            <ArrowRightIcon size={16} />
            Take the next step with us
          </p>
          <HeroPassportCards />
        </div>
      </div>
    </header>
  );
}
