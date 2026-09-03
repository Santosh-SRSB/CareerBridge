'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const REGISTER_HREF = '/employer/register';
const LOGIN_HREF = '/login?role=employer';
const JOBSEEKER_HREF = '/register?role=candidate';

const HIRE_STEPS = [
  {
    title: 'Post a job',
    copy: 'Launch a clear role in minutes. CareerBridge reaches skill-ready candidates across India.',
    tone: 'forest',
    visual: 'doc' as const,
  },
  {
    title: 'Find quality applicants',
    copy: 'Screening questions and match scores help you focus on people who actually fit.',
    tone: 'teal',
    visual: 'filter' as const,
  },
  {
    title: 'Make connections',
    copy: 'Track, invite, and interview from one workspace — no extra apps to download.',
    tone: 'gold',
    visual: 'chat' as const,
  },
  {
    title: 'Hire confidently',
    copy: 'Shortlist with evidence: skills, experience, and interview readiness in one view.',
    tone: 'navy',
    visual: 'badge' as const,
  },
] as const;

const DASH_FEATURES = [
  {
    title: 'Matched talent pool',
    copy: 'See ranked profiles that fit your job — not only people who already applied.',
    stat: '116',
    statLabel: 'matches',
    visual: 'pool' as const,
  },
  {
    title: 'Applicant pipeline',
    copy: 'Move candidates from review → shortlist → interview → hire with clear status.',
    stat: '4',
    statLabel: 'stages',
    visual: 'pipeline' as const,
  },
  {
    title: 'Company brand desk',
    copy: 'Keep location, industry, and contact details accurate for trust and verification.',
    stat: 'KYC',
    statLabel: 'ready',
    visual: 'shield' as const,
  },
] as const;

const CANDIDATES = [
  {
    name: 'Aisha Negi',
    city: 'Pune, MH',
    role: 'Paediatric Nursing',
    company: 'A&L Medical Center · 2020–present',
    education: "Bachelor's Degree, Central College",
    skills: ['EMR systems', 'Nursing', 'Vital signs'],
    initials: 'AN',
    tone: 'teal',
    match: 92,
    active: 'Active today',
  },
  {
    name: 'Rohan Mehta',
    city: 'Bengaluru, KA',
    role: 'Frontend Engineer',
    company: 'Pixel Labs · 2021–present',
    education: 'B.Tech Computer Science',
    skills: ['React', 'TypeScript', 'UI systems'],
    initials: 'RM',
    tone: 'forest',
    match: 88,
    active: 'Active 2h ago',
  },
  {
    name: 'Sneha Iyer',
    city: 'Chennai, TN',
    role: 'Customer Success Lead',
    company: 'Northwind Support · 2019–present',
    education: 'MBA Operations',
    skills: ['CRM', 'Coaching', 'SLA'],
    initials: 'SI',
    tone: 'gold',
    match: 85,
    active: 'Active yesterday',
  },
] as const;

const FAQ_PRIMARY = [
  {
    q: 'How do I create a CareerBridge for Employers account for free?',
    a: 'Click Post a job or Create account, verify your email with OTP, set a password, then complete company KYC to start hiring.',
  },
  {
    q: 'Does CareerBridge integrate with my ATS?',
    a: 'You can export shortlists and manage applicants in the employer workspace today. Deeper ATS integrations are on the roadmap.',
  },
  {
    q: 'How can I contact candidates who have not applied to my job?',
    a: 'After you publish a job, you can invite matched profiles from your talent pool to apply.',
  },
  {
    q: 'How does CareerBridge help me screen candidates?',
    a: 'Use skill matching scores, screening questions, assessments, and shortlist workflows inside your dashboard.',
  },
  {
    q: 'Can CareerBridge help with high-volume hiring?',
    a: 'Yes — post multiple roles, rank matches, and move candidates through review, interview, and hire stages in one place.',
  },
  {
    q: 'What are the benefits of a sponsored job post?',
    a: 'Sponsored visibility helps your opening reach more relevant candidates faster once marketplace boosts are enabled for your account.',
  },
  {
    q: 'Can sponsoring improve time-to-hire?',
    a: 'Higher visibility typically increases qualified applications, which can shorten time-to-shortlist when your role is well written.',
  },
];

const FAQ_SECONDARY = [
  {
    q: 'How can I improve visibility?',
    a: 'Write a clear title, add required skills, choose the right city, and keep the role published and active.',
  },
  {
    q: 'How do I attract top talent?',
    a: 'Highlight growth, salary range when possible, and use screening questions so serious candidates self-select.',
  },
  {
    q: 'How can CareerBridge help with employer branding?',
    a: 'Keep your company profile accurate — industry, location, and contact — so candidates trust your openings.',
  },
  {
    q: 'How much does it cost to post a job?',
    a: 'Hiring on CareerBridge is free during early access. Post jobs and review matched candidates with no posting fee.',
  },
  {
    q: 'Can I post without listing the salary?',
    a: 'Yes. Salary is optional, but sharing a range usually improves applicant quality and response rate.',
  },
  {
    q: 'How long until my job is visible?',
    a: 'Once published and verified, your job appears to matching candidates right away in the CareerBridge marketplace.',
  },
  {
    q: 'Why is a job here if I did not post it?',
    a: 'Demo and seeded marketplace roles may appear in local environments. Your live account only shows jobs you create.',
  },
];

function AccentRule({ align = 'center' }: { align?: 'center' | 'left' }) {
  return (
    <span className={`cb-emkt-rule ${align === 'left' ? 'cb-emkt-rule--left' : ''}`} aria-hidden />
  );
}

function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <ul className="cb-emkt-faq">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <li key={item.q} className={isOpen ? 'is-open' : ''}>
            <button
              type="button"
              className="cb-emkt-faq__q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : index)}
            >
              <span>{item.q}</span>
              <span className={`cb-emkt-faq__chev ${isOpen ? 'is-open' : ''}`} aria-hidden>
                ▾
              </span>
            </button>
            <div className={`cb-emkt-faq__panel ${isOpen ? 'is-open' : ''}`}>
              <p className="cb-emkt-faq__a">{item.a}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Section({
  children,
  className = '',
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`cb-emkt-section ${className}`.trim()}>
      {children}
    </section>
  );
}

function StepVisual({ kind }: { kind: (typeof HIRE_STEPS)[number]['visual'] }) {
  if (kind === 'doc') {
    return (
      <div className="cb-emkt-viz cb-emkt-viz--doc" aria-hidden>
        <span className="cb-emkt-viz__sheet" />
        <span className="cb-emkt-viz__line" />
        <span className="cb-emkt-viz__line is-short" />
        <span className="cb-emkt-viz__plus">＋</span>
      </div>
    );
  }
  if (kind === 'filter') {
    return (
      <div className="cb-emkt-viz cb-emkt-viz--filter" aria-hidden>
        <span className="cb-emkt-viz__ring">92%</span>
        <ul>
          <li className="is-on" />
          <li className="is-on" />
          <li />
        </ul>
      </div>
    );
  }
  if (kind === 'chat') {
    return (
      <div className="cb-emkt-viz cb-emkt-viz--chat" aria-hidden>
        <span className="cb-emkt-viz__bubble is-a" />
        <span className="cb-emkt-viz__bubble is-b" />
        <span className="cb-emkt-viz__nodes">
          <i /><i /><i />
        </span>
      </div>
    );
  }
  return (
    <div className="cb-emkt-viz cb-emkt-viz--badge" aria-hidden>
      <span className="cb-emkt-viz__seal">✓</span>
      <span className="cb-emkt-viz__bars">
        <i style={{ height: '40%' }} />
        <i style={{ height: '70%' }} />
        <i style={{ height: '55%' }} />
        <i style={{ height: '90%' }} />
      </span>
    </div>
  );
}

function FeatureVisual({ kind }: { kind: (typeof DASH_FEATURES)[number]['visual'] }) {
  if (kind === 'pool') {
    return (
      <div className="cb-emkt-featviz cb-emkt-featviz--pool" aria-hidden>
        <span /><span /><span /><span /><span /><span />
      </div>
    );
  }
  if (kind === 'pipeline') {
    return (
      <div className="cb-emkt-featviz cb-emkt-featviz--pipe" aria-hidden>
        <span>Review</span>
        <span>Shortlist</span>
        <span>Interview</span>
        <span className="is-hot">Hire</span>
      </div>
    );
  }
  return (
    <div className="cb-emkt-featviz cb-emkt-featviz--shield" aria-hidden>
      <span className="cb-emkt-featviz__shield">🛡</span>
      <span className="cb-emkt-featviz__ok">Verified</span>
    </div>
  );
}

function CandidateCard({
  person,
  featured = false,
}: {
  person: (typeof CANDIDATES)[number];
  featured?: boolean;
}) {
  return (
    <article className={`cb-emkt-person ${featured ? 'is-featured' : ''}`}>
      <div className="cb-emkt-person__top">
        <div className={`cb-emkt-person__avatar cb-emkt-person__avatar--${person.tone}`} aria-hidden>
          {person.initials}
        </div>
        <div className="min-w-0">
          <div className="cb-emkt-person__name-row">
            <strong>{person.name}</strong>
            <span className="cb-emkt-person__match">{person.match}% match</span>
          </div>
          <p className="cb-emkt-person__city">{person.city}</p>
        </div>
      </div>
      <p className="cb-emkt-person__role">
        <strong>{person.role}</strong>
        <br />
        {person.company}
      </p>
      <p className="cb-emkt-person__edu">{person.education}</p>
      <div className="cb-emkt-card__tags">
        {person.skills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>
      <button type="button" className="cb-emkt-card__msg cb-emkt-shimmer" tabIndex={-1}>
        ✉ Message
      </button>
      <p className="cb-emkt-card__active">● {person.active}</p>
    </article>
  );
}

export function EmployerMarketingLanding() {
  const [activeTab, setActiveTab] = useState<'match' | 'search'>('match');
  const [liveCount, setLiveCount] = useState(116);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveCount((n) => (n >= 128 ? 112 : n + 1));
    }, 2800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="cb-emkt">
      <header className="cb-emkt-nav">
        <div className="cb-emkt-nav__inner">
          <Link
          href="/employer/register"
            className="cb-emkt-nav__brand"
            aria-label="CareerBridge for Employers"
          >
            <Image
              src="/srsb-wordmark.png"
              alt="SRSB CareerBridge"
              width={408}
              height={170}
              className="cb-emkt-nav__logo"
              unoptimized
              priority
            />
            <span>For Employers</span>
          </Link>

          <nav className="cb-emkt-nav__links" aria-label="Employer marketing">
            <a href="#post">Post a job</a>
            <a href="#hire">Find talent</a>
            <a href="#features">Products</a>
            <a href="#pricing">Pricing</a>
            <a href="#resources">Resources</a>
          </nav>

          <div className="cb-emkt-nav__actions">
            <Link href="/#signin" className="cb-emkt-nav__help">
              Help
            </Link>
            <Link href={LOGIN_HREF} className="cb-emkt-nav__ghost">
              Sign in
            </Link>
            <Link href={REGISTER_HREF} className="cb-emkt-nav__solid cb-emkt-shimmer">
              Post a job
            </Link>
            <Link href={JOBSEEKER_HREF} className="cb-emkt-nav__seeker">
              For jobseekers
            </Link>
          </div>
        </div>
      </header>

      <section className="cb-emkt-hero" id="post">
        <div className="cb-emkt-hero__shade" />
        <div className="cb-emkt-hero__glow" aria-hidden />
        <div className="cb-emkt-hero__curve" aria-hidden />
        <div className="cb-emkt-hero__photo">
          <Image
            src="/auth/career-office.jpg"
            alt="Employer reviewing candidates"
            fill
            className="object-cover cb-emkt-hero__img"
            priority
            unoptimized
          />
        </div>
        <div className="cb-emkt-hero__float cb-emkt-hero__float--a" aria-hidden>
          <span>92% match</span>
          <strong>Frontend Engineer</strong>
        </div>
        <div className="cb-emkt-hero__float cb-emkt-hero__float--b" aria-hidden>
          <span>Live now</span>
          <strong>18 new applicants</strong>
        </div>
        <div className="cb-emkt-hero__copy">
          <p className="cb-emkt-hero__kicker">CareerBridge for Employers</p>
          <h1>
            Let’s hire your next great candidate. <em>Fast.</em>
          </h1>
          <p className="cb-emkt-hero__lead">
            No matter the skills, experience or qualifications you’re looking for, you’ll find the
            right people here — with matching, screening, and a hiring dashboard built for India.
          </p>
          <div className="cb-emkt-hero__actions">
            <Link href={REGISTER_HREF} className="cb-emkt-hero__cta cb-emkt-shimmer">
              Post a job
            </Link>
            <Link href={LOGIN_HREF} className="cb-emkt-hero__ghost">
              Sign in to hire
            </Link>
          </div>
          <div className="cb-emkt-hero__proof">
            <div>
              <strong>Skill matching</strong>
              <span>Ranked talent pool</span>
            </div>
            <div>
              <strong>OTP verified</strong>
              <span>Trusted accounts</span>
            </div>
            <div>
              <strong>One workspace</strong>
              <span>Post → shortlist → hire</span>
            </div>
          </div>
        </div>
      </section>

      <Section className="cb-emkt-hire" id="hire">
        <div className="cb-emkt-wrap cb-emkt-hire__inner">
          <h2>Manage your hiring from start to finish</h2>
          <AccentRule />
          <p className="cb-emkt-lead">
            A cleaner path from job post to hired candidate — with visuals that feel like real work,
            not empty marketing.
          </p>
          <div className="cb-emkt-hire__grid">
            {HIRE_STEPS.map((step, index) => (
              <article
                key={step.title}
                className={`cb-emkt-step cb-emkt-step--${step.tone}`}
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <div className="cb-emkt-step__media">
                  <StepVisual kind={step.visual} />
                </div>
                <div className="cb-emkt-step__body">
                  <span className="cb-emkt-step__num">0{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section className="cb-emkt-dash" id="features">
        <div className="cb-emkt-wrap">
          <h2>Your dashboard features</h2>
          <AccentRule align="left" />
          <p className="cb-emkt-lead cb-emkt-lead--left">
            Cards, pipelines, and match scores — the same language as your live employer workspace.
          </p>
          <div className="cb-emkt-dash__grid">
            {DASH_FEATURES.map((item, index) => (
              <article
                key={item.title}
                className={`cb-emkt-dash-card cb-emkt-dash-card--${item.visual}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="cb-emkt-dash-card__media">
                  <FeatureVisual kind={item.visual} />
                  <div className="cb-emkt-dash-card__stat">
                    <strong>{item.stat}</strong>
                    <span>{item.statLabel}</span>
                  </div>
                </div>
                <div className="cb-emkt-dash-card__body">
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Section>

      <Section className="cb-emkt-smart">
        <div className="cb-emkt-wrap cb-emkt-smart__grid">
          <div className="cb-emkt-smart__visual">
            <div className="cb-emkt-smart__blob" aria-hidden />
            <div className="cb-emkt-card cb-emkt-card--tabs">
              <div className="cb-emkt-card__tabs" role="tablist">
                <button
                  type="button"
                  className={activeTab === 'match' ? 'is-on' : ''}
                  onClick={() => setActiveTab('match')}
                >
                  Match candidates by job
                </button>
                <button
                  type="button"
                  className={activeTab === 'search' ? 'is-on' : ''}
                  onClick={() => setActiveTab('search')}
                >
                  Search for candidates
                </button>
              </div>
              <p className="cb-emkt-card__meta">
                <span className="cb-emkt-pulse" aria-hidden />
                {liveCount} resumes match your criteria
              </p>
            </div>
            <div className="cb-emkt-person-stack">
              {(activeTab === 'match' ? CANDIDATES : [...CANDIDATES].reverse()).map((person, i) => (
                <CandidateCard key={person.name} person={person} featured={i === 0} />
              ))}
            </div>
          </div>
          <div className="cb-emkt-smart__copy">
            <h2>Find matched candidates with CareerBridge Smart Matching</h2>
            <p>
              Publish a role and unlock profiles whose skills match your job description — then
              invite the best fits to apply from your employer dashboard.
            </p>
            <ul className="cb-emkt-checklist">
              <li>Ranked match % on every profile</li>
              <li>Invite candidates who haven’t applied yet</li>
              <li>Message and shortlist without leaving CareerBridge</li>
            </ul>
            <Link href={REGISTER_HREF} className="cb-emkt-text-cta">
              Explore Smart Matching →
            </Link>
          </div>
        </div>
      </Section>

      <Section className="cb-emkt-resources" id="resources">
        <div className="cb-emkt-wrap">
          <p className="cb-emkt-resources__stat">
            Clear job posts on CareerBridge move forward with stronger applicant quality than vague
            listings.
          </p>
          <div className="cb-emkt-resources__row">
            <div className="cb-emkt-resources__gallery">
              <div className="cb-emkt-resources__iconboard" aria-hidden>
                <div>
                  <span>▤</span>
                  <p>Job posts</p>
                </div>
                <div>
                  <span>◎</span>
                  <p>Match scores</p>
                </div>
                <div>
                  <span>✉</span>
                  <p>Invite & message</p>
                </div>
                <div>
                  <span>✓</span>
                  <p>Hire ready</p>
                </div>
              </div>
              <div className="cb-emkt-resources__chip">Hiring playbook</div>
            </div>
            <div>
              <h2>Hiring resources for every step of the process</h2>
              <p>
                Learn everything you need about managing your account, navigating your dashboard,
                and writing roles that attract the right people.
              </p>
              <div className="cb-emkt-resources__links">
                <Link href="/#signin">Employer Help Centre →</Link>
                <Link href="/#employers">Employer Resource Library →</Link>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section className="cb-emkt-quote">
        <div className="cb-emkt-wrap cb-emkt-quote__row">
          <div className="cb-emkt-quote__logo" aria-hidden>
            CB
          </div>
          <blockquote>
            <span className="cb-emkt-quote__mark" aria-hidden>
              “
            </span>
            <p>
              CareerBridge helped us shortlist skill-ready candidates faster — the matching scores
              and dashboard made hiring feel structured instead of chaotic.
            </p>
            <footer>
              <strong>Isha Patel, Head – Talent Acquisition</strong>
              <span>Demo employer story</span>
            </footer>
          </blockquote>
        </div>
        <div className="cb-emkt-mosaic">
          <div className="cb-emkt-mosaic__tile is-wide">
            <strong>Hiring workspace</strong>
            <p>Post · Match · Shortlist · Hire</p>
          </div>
          <div className="cb-emkt-proof-card cb-emkt-proof-card--match">
            <div className="cb-emkt-proof-card__icon" aria-hidden>
              <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="90 126"
                  strokeLinecap="round"
                  transform="rotate(-90 24 24)"
                />
                <text x="24" y="28" textAnchor="middle" fontSize="12" fontWeight="800" fill="currentColor">
                  92
                </text>
              </svg>
            </div>
            <div>
              <strong>Average match score</strong>
              <p>Skill fit across shortlisted profiles</p>
            </div>
          </div>
          <div className="cb-emkt-proof-card cb-emkt-proof-card--live">
            <div className="cb-emkt-proof-card__pulse" aria-hidden>
              <span />
            </div>
            <div>
              <strong>Roles going live</strong>
              <p>Published openings stay visible to matched talent</p>
            </div>
          </div>
        </div>
      </Section>

      <Section className="cb-emkt-ready" id="pricing">
        <div className="cb-emkt-ready__stage">
          <div className="cb-emkt-ready__photo" aria-hidden>
            <Image src="/auth/employer.png" alt="" fill className="object-cover" unoptimized />
          </div>
          <div className="cb-emkt-ready__photo cb-emkt-ready__photo--b" aria-hidden>
            <Image src="/auth/candidate.png" alt="" fill className="object-cover" unoptimized />
          </div>
          <div className="cb-emkt-ready__blob" aria-hidden />
          <div className="cb-emkt-ready__card">
            <h2>Ready to find your next hired candidate?</h2>
            <p>Create your employer account, verify email, and post your first role today.</p>
            <div className="cb-emkt-ready__actions">
              <Link href={REGISTER_HREF} className="cb-emkt-hero__cta cb-emkt-shimmer">
                Post a job
              </Link>
              <Link href={LOGIN_HREF} className="cb-emkt-ready__login">
                Already hiring? Sign in
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section className="cb-emkt-faq-block" id="faq">
        <div className="cb-emkt-wrap cb-emkt-faq-block__grid">
          <div>
            <h2>
              Frequently Asked
              <br />
              Questions
            </h2>
            <AccentRule align="left" />
          </div>
          <FaqList items={FAQ_PRIMARY} />
        </div>
        <div className="cb-emkt-wrap cb-emkt-faq-block__more">
          <FaqList items={FAQ_SECONDARY} />
        </div>
      </Section>

      <footer className="cb-emkt-foot">
        <div className="cb-emkt-wrap cb-emkt-foot__top">
          <div className="cb-emkt-foot__help">
            <h2>We&apos;re here to help</h2>
            <p>Visit our Help Centre for answers to common questions or contact us directly.</p>
            <div className="cb-emkt-foot__btns">
              <Link href="/#signin">Help Centre</Link>
              <Link href="/#signin">Contact support</Link>
            </div>
          </div>
          <div className="cb-emkt-foot__cols">
            <div>
              <h3>CareerBridge</h3>
              <Link href="/">About</Link>
              <Link href="/#signin">Security</Link>
              <Link href="/#signin">Terms</Link>
              <Link href="/#signin">Privacy</Link>
            </div>
            <div>
              <h3>Employers</h3>
              <Link href={REGISTER_HREF}>Post a job</Link>
              <a href="#features">Products</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <h3>Resources</h3>
              <Link href="/#employers">How to hire</Link>
              <Link href="/#employers">Job descriptions</Link>
              <Link href="/#employers">Interview guides</Link>
              <Link href={LOGIN_HREF}>Sign in</Link>
            </div>
          </div>
        </div>
        <div className="cb-emkt-foot__bottom">
          <div className="cb-emkt-foot__badges">
            <span>Secure hiring</span>
            <span>OTP verified</span>
            <span>India-first</span>
          </div>
          <p>© {new Date().getFullYear()} SRSB CareerBridge</p>
          <div className="cb-emkt-foot__social" aria-hidden>
            <span>●</span>
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
