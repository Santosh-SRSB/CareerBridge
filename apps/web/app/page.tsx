import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { PassportPreview } from '@/components/PassportPreview';
import { AnimatedBackdrop } from '@/components/AnimatedBackdrop';

const STEPS = [
  { n: '01', title: 'Build Profile', copy: 'Create your Career Passport with skills, education, and experience.' },
  { n: '02', title: 'Improve with AI', copy: 'Raise your resume and interview scores before you apply.' },
  { n: '03', title: 'Find Jobs', copy: 'See relevant roles first, not the longest list.' },
  { n: '04', title: 'Get Hired', copy: 'Apply with a passport employers can trust.' },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <section className="relative overflow-hidden">
        <AnimatedBackdrop />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-pill bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white">
              <span className="text-accent">Free</span> for Candidate
            </p>
            <h1 className="mt-6 max-w-xl text-5xl font-extrabold leading-[1.05] tracking-tight text-primary md:text-6xl">
              Build your career.
              <span className="mt-2 block text-accent">Build your future.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              CareerBridge is a candidate-first talent platform. Create a free Career Passport,
              improve your employability, and get discovered for the right jobs.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/register?role=candidate"
                className="rounded-sm bg-primary px-6 py-3.5 text-center text-base font-bold text-accent shadow-[0_12px_30px_rgba(11,28,28,0.22)] transition hover:bg-primary-hover"
              >
                Create Free Career Passport
              </Link>
              <Link
                href="/jobs"
                className="rounded-sm border border-primary bg-surface px-6 py-3.5 text-center text-base font-bold text-primary transition hover:bg-primary-soft"
              >
                Explore Jobs
              </Link>
            </div>
            <p className="mt-5 text-sm text-muted">
              Hiring?{' '}
              <Link href="/register?role=employer" className="font-bold text-orange hover:underline">
                Create employer account
              </Link>
            </p>
          </div>
          <div className="lg:pl-6">
            <PassportPreview />
          </div>
        </div>
      </section>

      <section className="border-y border-orange/20 bg-accent-soft">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-5 py-5">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange/15 text-2xl sm:flex">
            🤝
          </div>
          <p className="text-lg font-bold text-orange">
            We are the best place to get hired or hiring.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-orange">How it works</p>
        <h2 className="mt-2 text-3xl font-extrabold text-primary">From passport to offer, in four steps</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <article key={step.n} className="cb-card-hover p-5">
              <p className="text-sm font-extrabold text-accent">{step.n}</p>
              <h3 className="mt-3 text-lg font-bold text-primary">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.copy}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
