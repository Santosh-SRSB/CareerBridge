export function Hero() {
  return (
    <section
      id="get-started"
      className="relative overflow-hidden bg-navy text-white"
    >
      <div className="orb orb-orange -left-16 top-10 h-72 w-72" />
      <div className="orb orb-teal right-[-4rem] top-32 h-80 w-80" />
      <div className="hero-grid absolute inset-0" />
      <div className="grain" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:pb-28 lg:pt-20">
        <div>
          <p className="rise inline-flex items-center gap-2 rounded-full border border-teal/30 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            Free for candidates
          </p>

          <h1 className="font-display rise rise-2 mt-6 max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Build your career.
            <span className="mt-2 block bg-gradient-to-r from-orange via-orange-bright to-teal bg-clip-text text-transparent">
              Build your future.
            </span>
          </h1>

          <p className="rise rise-3 mt-6 max-w-lg text-base leading-7 text-white/75 sm:text-lg">
            Create your free Career Passport, improve your skills with AI, and
            find jobs. This platform is free for you — employers fund hiring,
            not job seekers.
          </p>

          <div className="rise rise-4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#passport"
              className="cta-shine inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-[0_16px_40px_-12px_rgba(242,92,34,0.9)] transition hover:-translate-y-0.5"
            >
              Create Free Career Passport
            </a>
            <a
              href="#jobs"
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur transition hover:border-teal/50 hover:bg-white/10"
            >
              Explore Jobs
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <span>No fees for candidates</span>
            <span className="hidden text-white/25 sm:inline">•</span>
            <span>AI that suggests, never invents</span>
            <span className="hidden text-white/25 sm:inline">•</span>
            <span>Built for mobile-first India</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -left-6 top-8 hidden h-24 w-24 rounded-3xl border border-teal/40 bg-teal/10 sm:block" />
          <div className="absolute -right-4 bottom-10 hidden h-16 w-16 rounded-full bg-orange/30 blur-sm sm:block" />

          <article className="passport-tilt relative overflow-hidden rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                  Career Passport
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">Rahul Kumar</h2>
                <p className="text-sm text-white/65">Chennai · Customer Service</p>
              </div>
              <span className="-rotate-6 rounded-full bg-orange px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-lg">
                Free
              </span>
            </div>

            <div className="rounded-2xl bg-navy-deep/60 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">Profile readiness</span>
                <span className="font-bold text-teal">78%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-teal to-orange" />
              </div>
              <p className="mt-3 text-xs text-white/55">
                You&apos;re 78% ready for your next opportunity.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {["Communication", "Customer Service", "MS Excel"].map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/90"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-[11px] text-white/50">Resume score</p>
                <p className="font-display text-xl font-bold text-orange-bright">72</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3">
                <p className="text-[11px] text-white/50">Interview score</p>
                <p className="font-display text-xl font-bold text-teal">68</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
