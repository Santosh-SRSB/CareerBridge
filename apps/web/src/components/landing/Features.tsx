const features = [
  {
    tag: "Identity",
    title: "Career Passport",
    body: "Personal info, education, skills, projects and preferences in one living profile. Resumes become generated views — not the source of truth.",
    accent: "from-teal/20 to-navy/5",
  },
  {
    tag: "AI Resume",
    title: "Builder that waits for you",
    body: "Pick a target job, see gaps, accept or skip suggestions, then generate, preview and download. AI never silently rewrites your history.",
    accent: "from-orange/20 to-navy/5",
  },
  {
    tag: "Practice",
    title: "AI mock interviews",
    body: "Text-first practice for a real role. Scores, strengths and a next drill — coaching, not an exam. Voice comes later.",
    accent: "from-teal/15 to-orange/10",
  },
  {
    tag: "Marketplace",
    title: "Jobs with a why",
    body: "Strong / Good / Potential match — plus the skills and location that got you there. No mystery AI score.",
    accent: "from-navy/10 to-teal/10",
  },
];

export function Features() {
  return (
    <section id="passport" className="bg-fog py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-deep">
          What you get
        </p>
        <h2 className="font-display mt-3 max-w-2xl text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          A Career Passport, not another resume dump.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className={`rounded-[28px] border border-white bg-gradient-to-br ${feature.accent} p-6 shadow-[0_16px_40px_-28px_rgba(9,53,78,0.5)] transition hover:-translate-y-1`}
            >
              <span className="rounded-full bg-navy px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                {feature.tag}
              </span>
              <h3 className="font-display mt-4 text-2xl font-bold text-navy">
                {feature.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted">{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
