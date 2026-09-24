'use client';

import Image from 'next/image';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="day-orbit-foot" id="signin">
      <div className="day-orbit-foot__sun">
        <h2>
          Let&apos;s make the next
          <br />
          move together.
        </h2>
        <Link className="day-orbit-foot__btn" href="/login">
          Get started
        </Link>
      </div>
      <svg
        className="day-orbit-foot__wave"
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,40 C240,90 480,0 720,40 C960,80 1200,10 1440,50 L1440,90 L0,90 Z"
          fill="#16382c"
        />
      </svg>
      <div className="day-orbit-foot__base">
        <div className="day-orbit-foot__main">
          <Link href="/" className="day-orbit-foot__logo" aria-label="SRSB Career Bridge">
            <Image
              src="/srsb-mark.png"
              alt="SRSB Career Bridge"
              width={240}
              height={96}
              className="h-[72px] w-auto max-w-[220px] object-contain sm:h-[88px]"
              unoptimized
              priority
            />
          </Link>
          <div>
            <h4>Candidate</h4>
            <Link href="/login?role=candidate">Candidate Login</Link>
            <Link href="/#candidates">Candidate Features</Link>
          </div>
          <div>
            <h4>Employer</h4>
            <Link href="/login?role=employer">Employer Login</Link>
            <Link href="/employer/welcome">Employer Features</Link>
          </div>
          <div>
            <h4>Links</h4>
            <Link href="/support">Support</Link>
            <Link href="/privacy">Privacy and Policy</Link>
            <Link href="/terms">Terms and Conditions</Link>
          </div>
        </div>
        <div className="day-orbit-foot__socials">
          <a
            href="https://www.linkedin.com"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            in
          </a>
          <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="X">
            X
          </a>
          <a href="mailto:hello@careerbridge.com" aria-label="Email">
            @
          </a>
          <a
            href="https://www.instagram.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram"
          >
            Ig
          </a>
          <a
            href="https://www.facebook.com"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook"
          >
            f
          </a>
        </div>
        <p className="day-orbit-foot__copy">
          © {new Date().getFullYear()} CareerBridge. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
