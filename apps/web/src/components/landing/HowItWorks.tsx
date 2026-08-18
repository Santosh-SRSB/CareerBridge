const steps = [
  {
    n: "01",
    title: "Build Profile",
    body: "Start with name, city, education and skills. No 27-field government form — your Career Passport grows as you do.",
  },
  {
    n: "02",
    title: "Improve with AI",
    body: "Get resume guidance and mock-interview practice. AI suggests. You approve. It never invents experience.",
  },
  {
    n: "03",
    title: "Find Jobs",
    body: "See roles that actually fit. Match explanations tell you why — and what to improve next.",
  },
  {
    n: "04",
    title: "Get Hired",
    body: "Apply in a tap, track every stage, and keep improving until the offer lands.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange">
          How it works
        </p>
        <h2 className="font-display mt-3 max-w-xl text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          Four steps. One living career identity.
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          Don&apos;t complete a complicated employment form. Build your
          professional identity progressively — and get value from the first
          session.
        </p>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className="group relative overflow-hidden rounded-3xl border border-line bg-fog p-5 transition hover:-translate-y-1 hover:border-teal/40 hover:shadow-[0_20px_40px_-24px_rgba(9,53,78,0.45)]"
            >
              <span className="font-display text-4xl font-extrabold text-navy/10 transition group-hover:text-orange/25">
                {step.n}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-navy">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
