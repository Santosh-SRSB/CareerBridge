const jobs = [
  {
    title: "Customer Service Executive",
    company: "ABC Services",
    location: "Chennai",
    pay: "₹18,000 – ₹24,000",
    match: "Strong Match",
    type: "Full Time",
  },
  {
    title: "Retail Associate",
    company: "XYZ Retail",
    location: "Madurai",
    pay: "₹15,000 – ₹20,000",
    match: "Good Match",
    type: "Full Time",
  },
  {
    title: "Front Office Executive",
    company: "PQR Hospitality",
    location: "Coimbatore",
    pay: "₹16,000 – ₹22,000",
    match: "Strong Match",
    type: "Full Time",
  },
];

export function JobsTeaser() {
  return (
    <section id="jobs" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange">
              Explore jobs
            </p>
            <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
              Roles that fit you, not a pile of listings.
            </h2>
          </div>
          <a
            href="#get-started"
            className="text-sm font-bold text-navy underline decoration-orange decoration-2 underline-offset-4"
          >
            Create a Passport to apply
          </a>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {jobs.map((job) => (
            <article
              key={job.title}
              className="rounded-3xl border border-line bg-white p-5 shadow-[0_12px_30px_-20px_rgba(9,53,78,0.35)] transition hover:-translate-y-1 hover:border-teal/40"
            >
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  job.match === "Strong Match"
                    ? "bg-teal/15 text-teal-deep"
                    : "bg-orange/15 text-orange"
                }`}
              >
                ★ {job.match}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-navy">
                {job.title}
              </h3>
              <p className="text-sm text-muted">{job.company}</p>
              <p className="mt-4 text-sm font-medium text-ink">
                {job.location} · {job.type}
              </p>
              <p className="mt-1 text-sm font-semibold text-navy">{job.pay}</p>
              <button
                type="button"
                className="mt-5 w-full rounded-full bg-navy py-2.5 text-sm font-bold text-white transition hover:bg-navy-mid"
              >
                View Job
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
