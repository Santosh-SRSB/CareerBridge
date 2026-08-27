'use client';

import { useEffect, useRef, useState } from 'react';

export type StackCourse = {
  id: string;
  icon: string;
  title: string;
  tag: string;
};

const DEFAULT_COURSES: StackCourse[] = [
  { id: 'cloud', icon: '☁️', title: 'Cloud Computing', tag: 'AWS · Azure' },
  { id: 'devops', icon: '⚙️', title: 'DevOps & CI/CD', tag: 'Pipelines' },
  { id: 'docker', icon: '🐳', title: 'Docker & K8s', tag: 'Containers' },
  { id: 'python', icon: '🐍', title: 'Python for AI', tag: 'ML basics' },
  { id: 'react', icon: '⚛️', title: 'React.js', tag: 'Frontend' },
  { id: 'cyber', icon: '🛡️', title: 'Cybersecurity', tag: 'Defense' },
  { id: 'data', icon: '📊', title: 'Data Analytics', tag: 'SQL · Excel' },
];

type StackItem = {
  key: string;
  course: StackCourse;
  /** 0 = bottom (oldest), higher = toward top of stack */
  level: number;
  phase: 'enter' | 'landed' | 'stacked' | 'exit';
};

type Props = {
  courses?: StackCourse[];
  onOpenPool?: () => void;
};

const MAX = 3;
const ENTER_MS = 850;
const PAUSE_MS = 430;
const RISE_MS = 640;
const GAP_MS = 520;
const EXIT_MS = 480;
const LEVEL_GAP = 86;
const LANDING_BOTTOM = 14;

export function CoursesStackCard({ courses = DEFAULT_COURSES, onOpenPool }: Props) {
  const [items, setItems] = useState<StackItem[]>([]);
  const [reduced, setReduced] = useState(false);
  const idx = useRef(0);
  const timers = useRef<number[]>([]);
  const itemsRef = useRef<StackItem[]>([]);
  const alive = useRef(true);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(() => {
        if (alive.current) resolve();
      }, ms);
      timers.current.push(id);
    });

  const setAll = (next: StackItem[]) => {
    itemsRef.current = next;
    setItems(next);
  };

  useEffect(() => {
    alive.current = true;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setReduced(mq.matches);
    syncMotion();
    mq.addEventListener?.('change', syncMotion);

    if (mq.matches) {
      setAll(
        courses.slice(0, MAX).map((course, i) => ({
          key: `static-${course.id}`,
          course,
          level: MAX - 1 - i,
          phase: 'stacked' as const,
        })),
      );
      return () => {
        alive.current = false;
        mq.removeEventListener?.('change', syncMotion);
      };
    }

    let stop = false;

    const run = async () => {
      while (!stop && alive.current) {
        const course = courses[idx.current % courses.length];
        idx.current += 1;
        const key = `${course.id}-${idx.current}-${Date.now()}`;

        // Enter from right at landing (level 0 visually until rise)
        setAll([
          ...itemsRef.current.filter((item) => item.phase !== 'exit'),
          { key, course, level: 0, phase: 'enter' },
        ]);
        await wait(30);
        if (stop || !alive.current) return;

        // Slide to left landing
        setAll(
          itemsRef.current.map((item) =>
            item.key === key ? { ...item, phase: 'landed' } : item,
          ),
        );
        await wait(ENTER_MS + PAUSE_MS);
        if (stop || !alive.current) return;

        // Rise onto stack: new becomes top. If already 3, fade oldest while reflowing.
        const active = itemsRef.current
          .filter((item) => item.key !== key && item.phase !== 'exit')
          .slice()
          .sort((a, b) => a.level - b.level);

        let risen: StackItem[];
        if (active.length >= MAX) {
          const [oldest, ...rest] = active;
          risen = [
            ...rest.map((item, i) => ({ ...item, level: i, phase: 'stacked' as const })),
            { key, course, level: rest.length, phase: 'stacked' },
            { ...oldest, phase: 'exit' },
          ];
          setAll(risen);
          await wait(Math.max(RISE_MS, EXIT_MS));
          if (stop || !alive.current) return;
          setAll(
            itemsRef.current
              .filter((item) => item.phase !== 'exit')
              .sort((a, b) => a.level - b.level)
              .map((item, i) => ({ ...item, level: i, phase: 'stacked' as const })),
          );
          await wait(180);
        } else {
          risen = [
            ...active.map((item, i) => ({ ...item, level: i, phase: 'stacked' as const })),
            { key, course, level: active.length, phase: 'stacked' },
          ];
          setAll(risen);
          await wait(RISE_MS);
          if (stop || !alive.current) return;
        }

        await wait(GAP_MS);
      }
    };

    void run();

    return () => {
      stop = true;
      alive.current = false;
      clearTimers();
      mq.removeEventListener?.('change', syncMotion);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses]);

  return (
    <section className="cb-courses-stack-card" aria-label="Courses and certifications">
      <div className="cb-courses-stack-card__aurora" aria-hidden />
      <div className="cb-courses-stack-card__sheen" aria-hidden />

      <header className="cb-courses-stack-card__head">
        <p className="cb-courses-stack-card__eyebrow">
          <span className="cb-courses-stack-card__pulse" aria-hidden />
          Keep learning
        </p>
        <h2>Courses &amp; Certifications</h2>
        <p className="cb-courses-stack-card__sub">
          Stack skills that employers notice — browse the full pool anytime.
        </p>
      </header>

      <div className={`cb-courses-stack-card__stage${reduced ? ' is-static' : ''}`}>
        {items.map((item) => {
          const atLanding = item.phase === 'enter' || item.phase === 'landed';
          return (
            <div
              key={item.key}
              className={`cb-courses-stack-block is-${item.phase}`}
              style={{
                bottom: atLanding
                  ? `${LANDING_BOTTOM}px`
                  : `${LANDING_BOTTOM + item.level * LEVEL_GAP}px`,
                zIndex: atLanding ? 40 : 10 + item.level,
              }}
            >
              <span className="cb-courses-stack-block__icon" aria-hidden>
                {item.course.icon}
              </span>
              <span className="cb-courses-stack-block__copy">
                <strong>{item.course.title}</strong>
                <em>{item.course.tag}</em>
              </span>
            </div>
          );
        })}
      </div>

      <button type="button" className="cb-courses-stack-card__cta" onClick={onOpenPool}>
        <span>Courses &amp; Certifications</span>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <path
            d="M5 12h12M13 6l6 6-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </section>
  );
}
