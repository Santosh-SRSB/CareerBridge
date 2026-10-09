"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { barWidth, CountUp, useInView } from "./home-motion";
import {
  ArrowRightIcon,
  BarsIcon,
  CalendarIcon,
  DocumentCheckIcon,
  MicIcon,
  PassportIcon,
  SearchIcon,
  SparkleIcon,
} from "./icons";

function PassportPreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>Career Passport</b>
        <span className="hl-mock__badge">VERIFIED</span>
      </div>
      <div className="hl-mock__who">
        <Image src="/landing/candidate-graduate.webp" alt="" width={330} height={424} />
        <div>
          <b>Priya Sharma</b>
          <span>Chennai · Customer Service</span>
        </div>
      </div>
      <div className="hl-mock__pair">
        <div>
          Resume
          <b>
            <CountUp value={82} />
          </b>
        </div>
        <div>
          Interview
          <b>
            <CountUp value={76} />
          </b>
        </div>
      </div>
      <div className="hl-mock__chips">
        <span>Communication</span>
        <span>MS Excel</span>
        <span>Teamwork</span>
      </div>
      <div className="hl-mock__progress">
        Profile strength
        <span className="hl-mock__track" style={barWidth(90)} />
      </div>
    </>
  );
}

function SkillRow({ label, value, gap = false }: { label: string; value: number; gap?: boolean }) {
  return (
    <div className={`hl-mock__skill${gap ? " is-gap" : ""}`}>
      <span className="hl-mock__skill-label">{label}</span>
      <span className="hl-mock__track" style={barWidth(value)} />
      <span className="hl-mock__skill-value">
        <CountUp value={value} suffix="%" />
      </span>
    </div>
  );
}

function SkillGapPreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>Skill Gap Analysis</b>
        <span className="hl-mock__badge">3 GAPS</span>
      </div>
      <SkillRow label="Communication" value={90} />
      <SkillRow label="MS Excel" value={60} gap />
      <SkillRow label="SQL" value={35} gap />
      <SkillRow label="Power BI" value={20} gap />
      <div className="hl-mock__tip">
        Recommended: <b>Advanced Excel</b> · 4 hrs
      </div>
    </>
  );
}

function AtsPreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>ATS Analysis</b>
        <span className="hl-mock__badge">AI</span>
      </div>
      <div className="hl-mock__ats">
        <div className="hl-mock__ring" style={{ "--hl-p": 78 } as CSSProperties}>
          <b>
            <CountUp value={78} />
          </b>
        </div>
        <div>
          <p className="hl-mock__check">Keywords match the role</p>
          <p className="hl-mock__check">Clean, readable format</p>
          <p className="hl-mock__check is-warn">Add measurable results</p>
        </div>
      </div>
      <div className="hl-mock__tip">
        Add 3 more keywords to reach <b>90+</b>
      </div>
    </>
  );
}

const WAVE_BARS = Array.from({ length: 14 }, (_, i) => i);

function InterviewPreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>AI Mock Interview</b>
        <span className="hl-mock__badge">LIVE</span>
      </div>
      <div className="hl-mock__bubble">Tell me about a time you handled a difficult customer.</div>
      <div className="hl-mock__wave">
        {WAVE_BARS.map((i) => (
          <span key={i} />
        ))}
      </div>
      <SkillRow label="Clarity" value={82} />
      <SkillRow label="Confidence" value={74} />
      <div className="hl-mock__tip">Feedback: add a measurable result to your answer.</div>
    </>
  );
}

function ProfilePreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>My Profile</b>
        <span className="hl-mock__badge">AI SUGGESTED</span>
      </div>
      <span className="hl-mock__line" style={{ width: "92%" }} />
      <span className="hl-mock__line" style={{ width: "78%" }} />
      <div className="hl-mock__chips hl-mock__chips--spaced">
        <span>Customer Support</span>
        <span>CRM</span>
        <span>English</span>
      </div>
      <div className="hl-mock__timeline">
        <div>
          Support Executive<span>2022 – Present</span>
        </div>
      </div>
      <div className="hl-mock__timeline hl-mock__timeline--late">
        <div>
          Trainee Associate<span>2021 – 2022</span>
        </div>
      </div>
    </>
  );
}

function JobRow({ title, meta, tag }: { title: string; meta: string; tag: string }) {
  return (
    <div className="hl-mock__job">
      <div>
        <b>{title}</b>
        <span>{meta}</span>
      </div>
      <span className="hl-mock__badge">{tag}</span>
    </div>
  );
}

function JobsPreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>Jobs for you</b>
        <span className="hl-mock__badge">3 NEW</span>
      </div>
      <JobRow title="Customer Success Executive" meta="Acme Corp · Chennai" tag="92%" />
      <JobRow title="Support Specialist" meta="BrightDesk · Remote" tag="88%" />
      <JobRow title="Operations Associate" meta="Zenith · Bengaluru" tag="81%" />
    </>
  );
}

function TrackingPreview() {
  return (
    <>
      <div className="hl-mock__head">
        <b>Application Tracker</b>
        <span className="hl-mock__badge">LIVE</span>
      </div>
      <div className="hl-mock__steps">
        <span className="is-done">Applied</span>
        <span className="is-done">Shortlisted</span>
        <span className="is-done">Interview</span>
        <span>Offer</span>
      </div>
      <div className="hl-mock__tip">
        <b>Tomorrow, 11:00 AM</b>
        <br />
        Interview · Acme Corp
      </div>
      <JobRow title="Support Specialist" meta="BrightDesk · Under review" tag="APPLIED" />
    </>
  );
}

type Feature = {
  id: string;
  title: string;
  tab: string;
  description: string;
  badges: [string, string];
  Icon: ComponentType<{ size?: number }>;
  Preview: ComponentType;
};

const FEATURES: Feature[] = [
  {
    id: "passport",
    title: "Career Passport",
    tab: "Passport",
    description:
      "Your professional identity in one place. Organized, verified and always up to date.",
    badges: ["Verified profile", "Resume score 82"],
    Icon: PassportIcon,
    Preview: PassportPreview,
  },
  {
    id: "skills",
    title: "Skill Gap Analysis",
    tab: "Skill Gaps",
    description:
      "Identify missing skills and get personalized recommendations to grow faster.",
    badges: ["3 skills to learn", "+18% in 4 weeks"],
    Icon: BarsIcon,
    Preview: SkillGapPreview,
  },
  {
    id: "ats",
    title: "AI Resume & ATS Analysis",
    tab: "ATS Analysis",
    description: "Get AI insights on your profile strength and how to improve your chances.",
    badges: ["ATS ready", "Score 78 to 90+"],
    Icon: DocumentCheckIcon,
    Preview: AtsPreview,
  },
  {
    id: "interview",
    title: "AI Mock Interviews",
    tab: "Mock Interview",
    description: "Practice role-specific interviews with AI and get detailed feedback.",
    badges: ["Live AI interviewer", "Feedback in seconds"],
    Icon: MicIcon,
    Preview: InterviewPreview,
  },
  {
    id: "profile",
    title: "AI-Powered Profile",
    tab: "AI Profile",
    description:
      "Create a comprehensive profile that showcases your skills, experience and achievements.",
    badges: ["AI-written summary", "Profile 90% done"],
    Icon: SparkleIcon,
    Preview: ProfilePreview,
  },
  {
    id: "jobs",
    title: "Smart Job Discovery",
    tab: "Job Discovery",
    description: "Find jobs that match your skills, experience, preferences and location.",
    badges: ["3 new matches", "92% match"],
    Icon: SearchIcon,
    Preview: JobsPreview,
  },
  {
    id: "tracking",
    title: "Interview Tracking",
    tab: "Tracking",
    description: "Track your applications, upcoming interviews and hiring progress.",
    badges: ["Interview tomorrow", "Shortlisted"],
    Icon: CalendarIcon,
    Preview: TrackingPreview,
  },
];

const PANEL_ID = "hl-cand-panel";
const tabId = (id: string) => `hl-cand-tab-${id}`;

export function CandidateFeatures() {
  const sectionRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLSpanElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const userPicked = useRef(false);
  const [active, setActive] = useState(0);
  const [holding, setHolding] = useState(false);
  const { inView, revealed } = useInView(sectionRef, 0.12);

  const feature = FEATURES[active];
  const { Icon, Preview } = feature;

  useEffect(() => {
    const tabs = tabsRef.current;
    const wrap = stageWrapRef.current;
    const pointer = pointerRef.current;
    if (!tabs || !wrap || !pointer) return;
    const place = () => {
      const tab = tabs.children[active] as HTMLElement | undefined;
      if (!tab) return;
      const t = tab.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      pointer.style.left = `${t.left + t.width / 2 - w.left}px`;
    };
    place();
    tabs.addEventListener("scroll", place, { passive: true });
    window.addEventListener("resize", place);
    return () => {
      tabs.removeEventListener("scroll", place);
      window.removeEventListener("resize", place);
    };
  }, [active]);

  useEffect(() => {
    const tabs = tabsRef.current;
    const tab = tabs?.children[active] as HTMLElement | undefined;
    if (!tabs || !tab) return;
    if (userPicked.current) {
      userPicked.current = false;
      tab.focus({ preventScroll: true });
    }
    if (tabs.scrollWidth > tabs.clientWidth) {
      tabs.scrollTo({
        left: tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2,
        behavior: "smooth",
      });
    }
  }, [active]);

  function select(index: number, focus = false) {
    userPicked.current = focus;
    setActive((index + FEATURES.length) % FEATURES.length);
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: FEATURES.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    select(keys[event.key], true);
  }

  function onTilt(event: MouseEvent<HTMLDivElement>) {
    const tilt = tiltRef.current;
    if (!tilt) return;
    const r = event.currentTarget.getBoundingClientRect();
    tilt.style.setProperty("--ry", `${((event.clientX - r.left) / r.width - 0.5) * 10}deg`);
    tilt.style.setProperty("--rx", `${-((event.clientY - r.top) / r.height - 0.5) * 8}deg`);
  }

  function resetTilt() {
    tiltRef.current?.style.setProperty("--rx", "0deg");
    tiltRef.current?.style.setProperty("--ry", "0deg");
  }

  const playing = inView && !holding;

  return (
    <section
      ref={sectionRef}
      id="candidate-features"
      className={`hl-cand${revealed ? " is-revealed" : ""}${playing ? "" : " is-paused"}`}
      aria-labelledby="hl-cand-title"
    >
      <div className="hl-section-head hl-section-head--center hl-reveal">
        <p className="hl-cap">For Candidates</p>
        <h2 id="hl-cand-title" className="hl-section-title">
          Build Your Career. <em className="hl-underline">Not Just Your Resume.</em>
        </h2>
        <p className="hl-section-lede">
          Build your profile, improve your skills and discover the right opportunities.
        </p>
      </div>

      <div
        ref={tabsRef}
        className="hl-tabs hl-reveal"
        role="tablist"
        aria-label="Candidate features"
      >
        {FEATURES.map((item, index) => {
          const selected = index === active;
          const TabIcon = item.Icon;
          return (
            <button
              key={item.id}
              id={tabId(item.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={PANEL_ID}
              tabIndex={selected ? 0 : -1}
              className={`hl-tab${selected ? " is-active" : ""}`}
              onClick={() => select(index)}
              onKeyDown={onTabKeyDown}
            >
              <span className="hl-tab__icon">
                <TabIcon size={24} />
              </span>
              <span>{item.tab}</span>
              <span
                className="hl-tab__progress"
                aria-hidden="true"
                onAnimationEnd={() => select(active + 1)}
              />
            </button>
          );
        })}
      </div>

      <div
        ref={stageWrapRef}
        className="hl-stage-wrap hl-reveal"
        onMouseEnter={() => setHolding(true)}
        onMouseLeave={() => setHolding(false)}
      >
        <span ref={pointerRef} className="hl-stage-wrap__pointer" aria-hidden="true" />
        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={tabId(feature.id)}
          className="hl-stage"
        >
          <div key={feature.id} className="hl-stage__copy">
            <span className="hl-stage__icon">
              <Icon size={28} />
            </span>
            <h3 className="hl-stage__title">{feature.title}</h3>
            <p className="hl-stage__text">{feature.description}</p>
            <Link href="/register?role=candidate" className="hl-btn hl-btn--light hl-stage__cta">
              Create Free Profile
              <ArrowRightIcon size={18} />
            </Link>
          </div>
          <div className="hl-stage__visual" onMouseMove={onTilt} onMouseLeave={resetTilt}>
            <div ref={tiltRef} className="hl-tilt" aria-hidden="true">
              <div key={feature.id} className="hl-mock">
                <Preview />
              </div>
              <span key={`${feature.id}-a`} className="hl-float-badge hl-float-badge--a">
                {feature.badges[0]}
              </span>
              <span key={`${feature.id}-b`} className="hl-float-badge hl-float-badge--b">
                {feature.badges[1]}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
