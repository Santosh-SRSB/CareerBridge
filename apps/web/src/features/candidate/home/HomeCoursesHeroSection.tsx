'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SkillMascot } from '@/components/SkillMascot';
import { recommendedCourses, type RecommendedCourse } from '@/lib/api';

const STAGGER_MS = 280;
const CARD_IN_MS = 650;
const FADE_FIRST_AFTER_MS = 5000;
const FADE_NEXT_AFTER_MS = 3000;
const RAIL_SLOTS = 5;
const RAIL_SWAP_MS = 3200;

function iconFor(title: string) {
  const t = title.toLowerCase();
  if (t.includes('cloud')) return '☁️';
  if (t.includes('ci/cd') || t.includes('devops') || t.includes('gitlab') || t.includes('github')) return '⚙️';
  if (t.includes('system design')) return '🧠';
  if (t.includes('sql') || t.includes('data')) return '🗃️';
  if (t.includes('react') || t.includes('javascript') || t.includes('frontend')) return '⚛️';
  if (t.includes('excel')) return '📊';
  if (t.includes('python')) return '🐍';
  if (t.includes('interview')) return '🎤';
  return '📚';
}

export function HomeCoursesHeroSection() {
  const router = useRouter();
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [railCourses, setRailCourses] = useState<RecommendedCourse[]>([]);
  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showSeeAll, setShowSeeAll] = useState(false);
  const [faded, setFaded] = useState<Record<string, boolean>>({});
  const [seeAllFaded, setSeeAllFaded] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    void recommendedCourses(12)
      .then((res) => {
        if (cancelled) return;
        const items = res.items ?? [];
        setCourses(items);
        setRailCourses(items.slice(0, RAIL_SLOTS));
      })
      .catch(() => {
        if (!cancelled) {
          setCourses([]);
          setRailCourses([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toastCourses = useMemo(() => courses.slice(0, 3), [courses]);

  useEffect(() => {
    if (!toastCourses.length) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    setVisibleCount(0);
    setShowSeeAll(false);
    setFaded({});
    setSeeAllFaded(false);
    setDismissed({});

    toastCourses.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setVisibleCount(i + 1);
        }, 120 + i * STAGGER_MS),
      );
    });

    const allInAt = 120 + (toastCourses.length - 1) * STAGGER_MS + CARD_IN_MS;
    timers.push(
      setTimeout(() => {
        if (!cancelled) setShowSeeAll(true);
      }, allInAt),
    );

    const fadeStart = allInAt + 80;
    const last = toastCourses.length - 1;
    if (last >= 0) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setFaded((prev) => ({ ...prev, [toastCourses[last].id]: true }));
        }, fadeStart + FADE_FIRST_AFTER_MS),
      );
    }
    if (last >= 1) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setFaded((prev) => ({ ...prev, [toastCourses[last - 1].id]: true }));
        }, fadeStart + FADE_FIRST_AFTER_MS + FADE_NEXT_AFTER_MS),
      );
    }
    if (last >= 2) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) {
            setFaded((prev) => ({ ...prev, [toastCourses[0].id]: true }));
            setSeeAllFaded(true);
          }
        }, fadeStart + FADE_FIRST_AFTER_MS + FADE_NEXT_AFTER_MS * 2),
      );
    } else {
      timers.push(
        setTimeout(() => {
          if (!cancelled) setSeeAllFaded(true);
        }, fadeStart + FADE_FIRST_AFTER_MS + FADE_NEXT_AFTER_MS),
      );
    }

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [toastCourses]);

  useEffect(() => {
    if (courses.length <= RAIL_SLOTS) return;
    const id = window.setInterval(() => {
      setRailCourses((prev) => {
        if (!prev.length) return prev;
        const slot = Math.floor(Math.random() * Math.min(RAIL_SLOTS, prev.length));
        setSwapSlot(slot);
        const used = new Set(prev.map((c) => c.id));
        const candidates = courses.filter((c) => !used.has(c.id));
        const next =
          candidates.length > 0
            ? candidates[Math.floor(Math.random() * candidates.length)]
            : courses[Math.floor(Math.random() * courses.length)];
        const copy = [...prev];
        copy[slot] = next;
        return copy;
      });
      window.setTimeout(() => setSwapSlot(null), 480);
    }, RAIL_SWAP_MS);
    return () => window.clearInterval(id);
  }, [courses]);

  const activeToasts = toastCourses.filter((c) => !dismissed[c.id]).slice(0, visibleCount);

  return (
    <section className="cb-home-courses-hero" aria-labelledby="home-courses-hero-title">
      <div className="cb-home-courses-hero__copy">
        <p className="cb-home-courses-hero__kicker">Courses</p>
        <h2 id="home-courses-hero-title" className="cb-home-courses-hero__title">
          We don&apos;t sell courses.
          <span className="cb-home-courses-hero__break">
            Our{' '}
            <em className="cb-home-courses-hero__mark">skill-gap suggestions</em>{' '}
            help you pick the right ones.
          </span>
        </h2>
        <p className="cb-home-courses-hero__lead">
          We analyse your resume skills, then recommend Udemy courses (via Impact) that can close those gaps.
        </p>
      </div>

      <div className="cb-home-courses-gap" aria-hidden="true">
        <div className="cb-home-courses-gap__sheet">
          <p className="cb-home-courses-gap__label">Gap scan</p>
          <div className="cb-home-courses-gap__row">
            <span>SQL</span>
            <strong className="is-low">Low</strong>
          </div>
          <div className="cb-home-courses-gap__row">
            <span>Excel</span>
            <strong className="is-mid">Mid</strong>
          </div>
          <div className="cb-home-courses-gap__row">
            <span>React</span>
            <strong className="is-high">Strong</strong>
          </div>
          <p className="cb-home-courses-gap__hint">→ Udemy picks ready</p>
        </div>
      </div>

      <aside className="cb-home-courses-hero__aside" aria-hidden="true">
        <SkillMascot pose="idea" className="cb-home-courses-hero__mascot" alt="" />
      </aside>

      <div className="cb-home-courses-rail" aria-label="Suggested courses">
        {railCourses.map((course, i) => (
          <article
            key={`${course.id}-${i}`}
            className={`cb-home-courses-rail__card${swapSlot === i ? ' is-swap' : ''}`}
          >
            <div className="cb-home-courses-rail__thumb" aria-hidden="true">
              {course.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={course.imageUrl} alt="" />
              ) : (
                <span>{iconFor(course.title)}</span>
              )}
              {course.instructorImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="cb-home-courses-rail__teacher"
                  src={course.instructorImageUrl}
                  alt=""
                />
              ) : null}
            </div>
            <h3 className="cb-home-courses-rail__title">{course.title}</h3>
            <p className="cb-home-courses-rail__instr">
              {course.instructor ? (
                <>
                  <span className="cb-home-courses-rail__by">
                    {course.instructorImageUrl ? null : (
                      <span className="cb-home-courses-rail__teacher-fallback" aria-hidden>
                        {(course.instructor[0] || 'U').toUpperCase()}
                      </span>
                    )}
                    {course.instructor}
                  </span>
                  {course.matchedSkill ? ` · ${course.matchedSkill}` : ''}
                </>
              ) : (
                <>
                  {course.provider}
                  {course.matchedSkill ? ` · for ${course.matchedSkill}` : ''}
                </>
              )}
            </p>
            <div className="cb-home-courses-rail__meta">
              <span className="cb-home-courses-rail__rating">{course.level}</span>
              <span className="cb-home-courses-rail__level">{course.duration}</span>
            </div>
            <div className="cb-home-courses-rail__bottom">
              <p className="cb-home-courses-rail__price">
                {course.strikeLabel ? <span>{course.strikeLabel}</span> : null}
                {course.priceLabel}
              </p>
              <a className="cb-home-courses-rail__btn" href={course.url} target="_blank" rel="noreferrer">
                Get
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="cb-home-courses-hero__see-all">
        <button
          type="button"
          className="cb-home-courses-rec__see-btn"
          onClick={() => router.push('/courses')}
        >
          See all courses
        </button>
      </div>

      <div className="cb-course-toasts" aria-live="polite" aria-label="Course recommendations">
        {activeToasts.map((course, i) => {
          const isFaded = Boolean(faded[course.id]);
          return (
            <article
              key={course.id}
              className={`cb-course-toast is-in${isFaded ? ' is-out' : ''}`}
              style={{ zIndex: 20 + i }}
            >
              <button
                type="button"
                className="cb-course-toast__close"
                aria-label={`Dismiss ${course.title}`}
                onClick={() => setDismissed((prev) => ({ ...prev, [course.id]: true }))}
              >
                ×
              </button>

              <div className="cb-course-toast__thumb" aria-hidden="true">
                {course.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={course.imageUrl} alt="" />
                ) : (
                  <span>{iconFor(course.title)}</span>
                )}
                {course.instructorImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="cb-course-toast__teacher"
                    src={course.instructorImageUrl}
                    alt=""
                  />
                ) : null}
              </div>

              <div className="cb-course-toast__body">
                <div className="cb-course-toast__top">
                  <h3 className="cb-course-toast__name">{course.title}</h3>
                  <span className="cb-course-toast__level">{course.level}</span>
                </div>
                <p className="cb-course-toast__instr">
                  {course.instructor || course.provider}
                </p>
                <div className="cb-course-toast__meta">
                  <span className="cb-course-toast__rating">{course.matchedSkill}</span>
                  <span>{course.duration}</span>
                </div>
                <p className="cb-course-toast__desc">{course.blurb}</p>
                <div className="cb-course-toast__bottom">
                  <p className="cb-course-toast__price">
                    {course.strikeLabel ? (
                      <span className="cb-course-toast__strike">{course.strikeLabel}</span>
                    ) : null}
                    {course.priceLabel}
                  </p>
                  <a className="cb-course-toast__btn" href={course.url} target="_blank" rel="noreferrer">
                    Get Course
                  </a>
                </div>
              </div>
            </article>
          );
        })}

        {showSeeAll ? (
          <div className={`cb-course-toast-see is-in${seeAllFaded ? ' is-out' : ''}`}>
            <button
              type="button"
              className="cb-course-toast-see__btn"
              onClick={() => router.push('/courses')}
            >
              See all courses
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
