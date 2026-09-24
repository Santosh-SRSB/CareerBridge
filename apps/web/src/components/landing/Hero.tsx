import Link from "next/link";
import { PassportDeck } from "@/components/landing/PassportDeck";
import { HeroSky } from "@/components/landing/HeroSky";
import { HeroProof } from "@/components/landing/HeroProof";

export function Hero() {
  return (
    <section id="get-started" className="relative overflow-hidden bg-fog">
      <HeroSky />
      <div className="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center gap-14 px-5 py-12 sm:px-10 lg:flex-row lg:gap-14 lg:py-[72px] lg:pb-14">
        <div className="hero-left w-full min-w-0 flex-[1.05]">
          <h1 className="font-display pt-[5.5rem] text-[34px] font-extrabold leading-[1.08] sm:text-[42px] lg:pt-16 lg:text-[56px]">
            <span className="hero-line-2 relative mt-0 block text-orange">
              <span className="hang-tag" aria-label="Dream Job / Loading...">
                <span className="hang-tag-swing">
                  <span className="hang-tag-nail" aria-hidden="true" />
                  <span className="hang-tag-paper">
                    <span className="hang-tag-free">Dream Job</span>
                    <span className="hang-tag-sub">/ Loading...</span>
                  </span>
                </span>
              </span>
              Every career has a next step. Find yours.
            </span>
          </h1>

          <p className="mt-[26px] mb-[34px] max-w-[480px] text-[17px] leading-[1.65] text-muted">
            Build a Career Passport that works for you — sharpening your skills, closing the
            gaps, and matching you to the right job.
          </p>

          <Link
            href="/login"
            className="inline-flex rounded-full bg-[#0a2e2c] px-7 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(10,46,44,0.25)] transition hover:-translate-y-0.5 hover:bg-[#072422]"
          >
            Explore
          </Link>

          <HeroProof />
        </div>

        <div className="w-full min-w-0 flex-1">
          <PassportDeck />
        </div>
      </div>
    </section>
  );
}
