"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { barWidth, useInView } from "./home-motion";
import { ArrowRightIcon } from "./icons";

const MOBILE_QUERY = "(max-width: 760px)";

function subscribeToMobile(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const readMobile = () => window.matchMedia(MOBILE_QUERY).matches;
const readMobileOnServer = () => false;

const delay = (seconds: number) => ({ animationDelay: `${seconds}s` });

function MockHead({ title, badge }: { title: string; badge: string }) {
  return (
    <div className="hl-mock__head">
      <b>{title}</b>
      <span className="hl-mock__badge">{badge}</span>
    </div>
  );
}

function Field({ label, at, children }: { label: string; at: number; children: ReactNode }) {
  return (
    <div className="hl-win__field" style={delay(at)}>
      <small>{label}</small>
      {children}
    </div>
  );
}

function PersonRow({
  initials,
  name,
  role,
  insight,
  at,
  children,
}: {
  initials: string;
  name: string;
  role: string;
  insight?: string;
  at: number;
  children: ReactNode;
}) {
  return (
    <div className="hl-win__person" style={delay(at)}>
      <span className="hl-win__avatar">{initials}</span>
      <div>
        <b>{name}</b>
        <small>{role}</small>
        {insight ? <span className="hl-win__insight">{insight}</span> : null}
      </div>
      {children}
    </div>
  );
}

function MatchMeter({ value }: { value: number }) {
  return (
    <div className="hl-win__meter">
      <span className="hl-mock__track" style={barWidth(value)} />
      {value}%
    </div>
  );
}

function RequirementWindow() {
  return (
    <>
      <MockHead title="New requirement" badge="DRAFT" />
      <Field label="Role title" at={0.05}>
        <p>Customer Success Executive</p>
      </Field>
      <Field label="Must-have skills" at={0.15}>
        <div className="hl-mock__chips">
          <span>Communication</span>
          <span>CRM</span>
          <span>English</span>
        </div>
      </Field>
      <div className="hl-win__row">
        <Field label="Experience" at={0.25}>
          <p>2–4 years</p>
        </Field>
        <Field label="Location" at={0.35}>
          <p>Chennai</p>
        </Field>
      </div>
      <div className="hl-mock__tip">Scorecard ready · 3 must-haves defined</div>
    </>
  );
}

function MatchWindow() {
  return (
    <>
      <MockHead title="Top matches" badge="12 CANDIDATES" />
      <PersonRow initials="AR" name="Ananya Rao" role="Customer Success · 3 yrs" at={0.05}>
        <MatchMeter value={94} />
      </PersonRow>
      <PersonRow initials="AM" name="Arjun Mehta" role="Support Lead · 4 yrs" at={0.2}>
        <MatchMeter value={89} />
      </PersonRow>
      <PersonRow initials="PS" name="Priya Sharma" role="Customer Service · 2 yrs" at={0.35}>
        <MatchMeter value={83} />
      </PersonRow>
      <div className="hl-mock__tip">Ranked by skills, experience and role fit</div>
    </>
  );
}

function ShortlistWindow() {
  const tag = <span className="hl-win__ok">Shortlisted</span>;
  return (
    <>
      <MockHead title="Shortlist" badge="3 OF 12" />
      <PersonRow
        initials="AR"
        name="Ananya Rao"
        role="Customer Success"
        insight="Strong CRM and communication"
        at={0.05}
      >
        {tag}
      </PersonRow>
      <PersonRow
        initials="AM"
        name="Arjun Mehta"
        role="Support Lead"
        insight="Led a team of 6"
        at={0.2}
      >
        {tag}
      </PersonRow>
      <PersonRow
        initials="PS"
        name="Priya Sharma"
        role="Customer Service"
        insight="Verified skills match"
        at={0.35}
      >
        {tag}
      </PersonRow>
    </>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function InterviewWindow() {
  return (
    <>
      <MockHead title="This week" badge="INVITES SENT" />
      <div className="hl-win__days">
        {DAYS.map((day) => (
          <span key={day} className={day === "Thu" ? "is-active" : undefined}>
            {day}
          </span>
        ))}
      </div>
      <div className="hl-win__slot is-active" style={delay(0.1)}>
        <b>11:00 AM</b> · Interview · Ananya Rao
      </div>
      <div className="hl-win__slot" style={delay(0.25)}>
        <b>2:30 PM</b> · Interview · Arjun Mehta
      </div>
      <div className="hl-win__slot is-free" style={delay(0.4)}>
        4:00 PM · Available
      </div>
    </>
  );
}

const PIPELINE = [
  { label: "Applied", count: 12, cards: 3, at: 0.05 },
  { label: "Shortlist", count: 6, cards: 2, at: 0.2 },
  { label: "Interview", count: 3, cards: 1, at: 0.35 },
  { label: "Hired", count: 1, cards: 1, at: 0.5 },
];

function HireWindow() {
  return (
    <>
      <MockHead title="Hiring pipeline" badge="LIVE" />
      <div className="hl-win__board">
        {PIPELINE.map((column) => (
          <div key={column.label} className="hl-win__column" style={delay(column.at)}>
            <b>
              {column.label} <span>{column.count}</span>
            </b>
            {Array.from({ length: column.cards }, (_, i) => (
              <span key={i} className="hl-win__card" />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

type Step = {
  id: string;
  label: string;
  title: string;
  text: string;
  Window: ComponentType;
};

const STEPS: Step[] = [
  {
    id: "requirement",
    label: "Requirement",
    title: "Create Job Requirements",
    text: "Define role, skills, experience and other requirements in a structured way.",
    Window: RequirementWindow,
  },
  {
    id: "match",
    label: "Match",
    title: "AI-Powered Matching",
    text: "Get matched with relevant candidates based on skills, experience and role fit.",
    Window: MatchWindow,
  },
  {
    id: "shortlist",
    label: "Shortlist",
    title: "Candidate Shortlisting",
    text: "Shortlist the most relevant candidates faster with AI assistance.",
    Window: ShortlistWindow,
  },
  {
    id: "interview",
    label: "Interview",
    title: "Interview Management",
    text: "Schedule interviews, share updates and communicate seamlessly.",
    Window: InterviewWindow,
  },
  {
    id: "hire",
    label: "Hire",
    title: "Hiring Pipeline",
    text: "Track candidates across different stages of your hiring process.",
    Window: HireWindow,
  },
];

function EmployerWindow({ step }: { step: Step }) {
  const { Window } = step;
  return (
    <div className="hl-win" aria-hidden="true">
      <div className="hl-win__bar">
        <span />
        <span />
        <span />
        <span className="hl-win__url">srsbcareerbridge.com/employer</span>
      </div>
      <div key={step.id} className="hl-win__content">
        <Window />
      </div>
    </div>
  );
}

export function EmployerFeatures() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [holding, setHolding] = useState(false);
  const isMobile = useSyncExternalStore(subscribeToMobile, readMobile, readMobileOnServer);
  const { inView, revealed } = useInView(sectionRef, 0.1);

  const playing = inView && !holding;
  const current = STEPS[active];

  return (
    <section
      ref={sectionRef}
      id="employer-features"
      className={`hl-emp${revealed ? " is-revealed" : ""}${playing ? "" : " is-paused"}`}
      aria-labelledby="hl-emp-title"
    >
      <div className="hl-emp__head hl-reveal">
        <p className="hl-cap">For Employers</p>
        <h2 id="hl-emp-title" className="hl-section-title">
          Hire Smarter. <em>Spend Less Time Searching.</em>
        </h2>
        <p className="hl-section-lede">
          Post requirements, find relevant talent and build high-performing teams.
        </p>
      </div>

      <div
        className="hl-emp__body hl-reveal"
        onMouseEnter={() => setHolding(true)}
        onMouseLeave={() => setHolding(false)}
      >
        <ol className="hl-steps">
          {STEPS.map((step, index) => {
            const on = index === active;
            const toggleId = `hl-step-${step.id}`;
            const bodyId = `hl-step-${step.id}-body`;
            return (
              <li key={step.id} className={`hl-step${on ? " is-active" : ""}`}>
                <span
                  className="hl-step__line"
                  aria-hidden="true"
                  onAnimationEnd={
                    on ? () => setActive((value) => (value + 1) % STEPS.length) : undefined
                  }
                />
                <span className="hl-step__num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="hl-step__heading">
                  <button
                    id={toggleId}
                    type="button"
                    className="hl-step__toggle"
                    aria-expanded={on}
                    aria-controls={bodyId}
                    onClick={() => setActive(index)}
                  >
                    <span className="sr-only">Step {index + 1}: </span>
                    {step.label}
                  </button>
                </h3>
                <div
                  id={bodyId}
                  role="region"
                  aria-labelledby={toggleId}
                  className="hl-step__body"
                  inert={!on}
                >
                  <div className="hl-step__inner">
                    <div className="hl-step__card">
                      <h4>{step.title}</h4>
                      <p>{step.text}</p>
                    </div>
                    {isMobile && on ? <EmployerWindow step={step} /> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {isMobile ? null : (
          <div className="hl-emp__window">
            <EmployerWindow step={current} />
          </div>
        )}
      </div>

      <div className="hl-emp__actions hl-reveal">
        <Link href="/employer/welcome" className="hl-pill hl-pill--primary">
          Explore Employer Workspace
          <span className="hl-pill__arrow">
            <ArrowRightIcon size={18} />
          </span>
        </Link>
        <Link href="/employer/register" className="hl-pill hl-pill--outline">
          Post a job
          <span className="hl-pill__arrow">
            <ArrowRightIcon size={18} />
          </span>
        </Link>
      </div>
    </section>
  );
}
