import Link from "next/link";

export function EmployerBand() {
  return (
    <section id="employers" className="relative overflow-hidden bg-navy py-16 text-white">
      <div className="orb orb-orange right-10 top-0 h-56 w-56 opacity-40" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal">
            For employers
          </p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Hire the right people faster — and more affordably.
          </h2>
          <p className="mt-4 text-white/70">
            Skill-based matching, AI-assisted job posts, and a simple shortlist
            flow. Candidates stay free. You pay for hiring value.
          </p>
        </div>
        <Link
          href="/employer/welcome"
          className="inline-flex rounded-full bg-white px-7 py-3.5 text-sm font-bold text-navy shadow-lg transition hover:-translate-y-0.5 hover:bg-fog"
        >
          Post Your First Job
        </Link>
      </div>
    </section>
  );
}
