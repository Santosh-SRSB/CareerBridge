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
          <h1 className="font-display pt-[5.5rem] text-[34px] font-extrabold leading-[1.08] text-navy sm:text-[42px] lg:pt-16 lg:text-[56px]">
            <span className="hero-line-1 block">
              <span className="relative inline-block">
                <span className="hang-tag" aria-label="Free for Candidate">
                  <span className="hang-tag-swing">
                    <span className="hang-tag-nail" aria-hidden="true" />
                    <span className="hang-tag-paper">
                      <span className="hang-tag-free">FREE</span>
                      <span className="hang-tag-sub">for Candidate</span>
                    </span>
                  </span>
                </span>
                B
              </span>
              uild your career.
            </span>
            <span className="hero-line-2 mt-0 block text-orange">
              Build your future.
            </span>
          </h1>

          <p className="mt-[26px] mb-[34px] max-w-[480px] text-[17px] leading-[1.65] text-muted">
            Create your free Career Passport, improve your skills with AI, and find
            jobs. This platform is free for you — employers fund hiring, not job
            seekers.
          </p>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-bold text-navy">
            <Link href="/login" className="underline-offset-4 transition hover:text-orange hover:underline">
              Login
            </Link>
            <span className="text-muted/50" aria-hidden="true">
              |
            </span>
            <Link
              href="/register?role=candidate"
              className="underline-offset-4 transition hover:text-orange hover:underline"
            >
              Signup
            </Link>
          </p>

          <HeroProof />
        </div>

        <div className="w-full min-w-0 flex-1">
          <PassportDeck />
        </div>
      </div>
    </section>
  );
}
