'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { PassportPreview } from '@/components/PassportPreview';
import { PASSPORT_FLOW_START } from '@/lib/passport-flow';

type MissingItem = { label: string; href: string };
type TipPhase = 'tip' | 'found' | 'pills' | 'button';

type Props = {
  name: string;
  city: string;
  percentage: number;
  skills: string[];
  resumeScore: number | null;
  interviewScore: number | null;
  passportId: string;
  photoUrl?: string | null;
  role?: string;
  missing?: MissingItem[];
};

const PASSPORT_HOLDS = [
  {
    id: 'personal',
    title: 'Personal details',
    note: 'Name, location, and how employers can reach you.',
  },
  {
    id: 'education',
    title: 'Education',
    note: 'Your qualifications and the schools behind them.',
  },
  {
    id: 'skills',
    title: 'Skills',
    note: 'What you can do — so the right roles can find you.',
  },
  {
    id: 'experience',
    title: 'Experience',
    note: 'Jobs, internships, and the work you have done.',
  },
  {
    id: 'preferences',
    title: 'Career preferences',
    note: 'The kind of work you want next.',
  },
  {
    id: 'proof',
    title: 'Projects & certifications',
    note: 'Proof of what you have built and learned.',
  },
];

function KeyTipsPanel({ missing }: { missing: MissingItem[] }) {
  const [phase, setPhase] = useState<TipPhase>('tip');
  const [cycle, setCycle] = useState(0);
  const completeHref = missing[0]?.href || PASSPORT_FLOW_START;
  const hasMissing = missing.length > 0;
  const pillCount = Math.min(missing.length, 5);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    async function runLoop() {
      while (!cancelled) {
        setPhase('tip');
        await wait(2400);
        if (cancelled) break;

        setPhase('found');
        await wait(450);
        if (cancelled) break;

        if (hasMissing) {
          setCycle((value) => value + 1);
          setPhase('pills');
          await wait(pillCount * 120 + 200);
          if (cancelled) break;

          setPhase('button');
          await wait(2800);
        } else {
          await wait(2800);
        }
        if (cancelled) break;
      }
    }

    void runLoop();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [hasMissing, pillCount]);

  return (
    <aside className={`cb-key-tips${phase !== 'tip' ? ' is-swapped' : ''}`} aria-label="Key tips">
      <span className="cb-key-tips__glow" aria-hidden="true" />
      <span className="cb-key-tips__bulb" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="22" r="11" fill="#fde68a" />
          <circle cx="24" cy="22" r="7" fill="#fbbf24" />
          <circle cx="21" cy="19" r="2.2" fill="#fff7c2" opacity="0.9" />
          <path d="M20 33h8M21 37h6" stroke="#92400e" strokeWidth="2.2" strokeLinecap="round" />
          <path
            d="M24 4v3M8 22H5M43 22h-3M12.5 10.5l-2-2M35.5 10.5l2-2"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <div className="cb-key-tips__body">
        <div className={`cb-key-tips__scene cb-key-tips__scene--tip${phase === 'tip' ? ' is-active' : ''}`}>
          <p className="cb-key-tips__kicker">Key tips</p>
          <p className="cb-key-tips__copy">
            Recruiters generally prefer a <strong>100% complete profile</strong>.
          </p>
        </div>

        <div
          className={`cb-key-tips__scene cb-key-tips__scene--found${
            phase === 'found' || phase === 'pills' || phase === 'button' ? ' is-active' : ''
          }`}
        >
          {hasMissing ? (
            <>
              <p className="cb-key-tips__kicker">Found missing details</p>
              <ul
                key={cycle}
                className={`cb-key-tips__pills${phase === 'pills' || phase === 'button' ? ' is-show' : ''}`}
              >
                {missing.slice(0, 5).map((item, index) => (
                  <li key={item.label} style={{ animationDelay: `${index * 0.12}s` }}>
                    <Link href={item.href} className="cb-key-tips__pill">
                      {item.label.replace(/^Career\s+/i, '')}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link
                href={completeHref}
                className={`cb-key-tips__btn${phase === 'button' ? ' is-show' : ''}`}
              >
                Complete profile
              </Link>
            </>
          ) : (
            <>
              <p className="cb-key-tips__kicker">All set</p>
              <p className="cb-key-tips__copy cb-key-tips__copy--done">
                Your profile looks completed.
              </p>
              <Link href="/profile" className="cb-key-tips__btn is-show">
                Edit profile
              </Link>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}

export function HomePassportSection(props: Props) {
  const missing = props.missing ?? [];

  return (
    <section className="cb-home-passport-block" aria-label="Career Passport">
      <div className="cb-home-passport-col">
        <PassportPreview
          name={props.name}
          location={props.city}
          role={props.role}
          ready={props.percentage}
          skills={props.skills}
          photoUrl={props.photoUrl}
          resumeScore={props.resumeScore}
          interviewScore={props.interviewScore}
          passportId={props.passportId}
        />
      </div>

      <aside className="cb-home-passport-holds" aria-labelledby="passport-holds-title">
        <p className="cb-home-passport-holds__kicker">Career Passport</p>
        <div className="cb-home-passport-holds__title-row">
          <h2 id="passport-holds-title">What your passport holds</h2>
          <span className="cb-home-passport-holds__q" aria-hidden="true">
            ?
          </span>
          <div className="cb-key-tips-wrap">
            <KeyTipsPanel missing={missing} />
          </div>
        </div>
        <p className="cb-home-passport-holds__lead">
          Everything recruiters look for is in one place — your Career Passport card.
        </p>
        <ul className="cb-home-passport-holds__list">
          {PASSPORT_HOLDS.map((item) => (
            <li key={item.id} className={`cb-hold-card cb-hold-card--${item.id}`}>
              <span className="cb-hold-card__icon" aria-hidden="true" />
              <strong>{item.title}</strong>
              <span>{item.note}</span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
