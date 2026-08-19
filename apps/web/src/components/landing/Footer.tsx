import Image from "next/image";

export function Footer() {
  return (
    <footer id="signin" className="bg-navy text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <Image
            src="/srsb-wordmark.png"
            alt="SRSB"
            width={408}
            height={170}
            className="h-10 w-auto bg-transparent"
            unoptimized
          />
          <p className="mt-4 max-w-xs text-sm leading-6 text-white/60">
            SRSB CareerBridge — a free Career Passport for youth, and a hiring
            workspace for employers.
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal">
            Candidates
          </p>
          <ul className="mt-4 space-y-2 text-sm text-white/70">
            <li>
              <a href="#get-started" className="hover:text-white">
                Create Career Passport
              </a>
            </li>
            <li>
              <a href="#jobs" className="hover:text-white">
                Explore Jobs
              </a>
            </li>
            <li>
              <a href="#passport" className="hover:text-white">
                AI Resume & Interviews
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-bright">
            Sign in
          </p>
          <p className="mt-4 text-sm text-white/70">
            Auth lands in the next slice. For now, this is the candidate
            landing — registration, OTP and dashboards come next.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a
              href="#get-started"
              className="rounded-full bg-white px-5 py-2.5 text-center text-sm font-bold text-navy"
            >
              Get started free
            </a>
            <a
              href="#employers"
              className="rounded-full border border-white/20 px-5 py-2.5 text-center text-sm font-semibold text-white"
            >
              I&apos;m hiring
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">
        © {new Date().getFullYear()} SRSB · CareerBridge · Candidates never pay
        for core tools
      </div>
    </footer>
  );
}
