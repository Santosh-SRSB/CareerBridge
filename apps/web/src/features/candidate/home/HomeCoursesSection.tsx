'use client';

import { CoursesStackCard } from '@/components/CoursesStackCard';
import { GapCourseNudge } from '@/components/GapCourseNudge';

type Props = {
  gapMonths?: number | null;
  onOpenCourses: () => void;
};

export function HomeCoursesSection({ gapMonths, onOpenCourses }: Props) {
  return (
    <section className="cb-home-section cb-home-section--courses" aria-labelledby="home-courses-title">
      <header className="cb-home-section__head">
        <div>
          <p className="cb-home-section__kicker">Learning path</p>
          <h2 id="home-courses-title">Course suggestions for your gaps</h2>
          <p className="cb-home-section__sub">
            We analyse your skill gaps and recommend Udemy courses that can help you catch up — we
            don&apos;t sell or host the courses ourselves.
          </p>
        </div>
      </header>

      <GapCourseNudge gapMonths={gapMonths} />
      <CoursesStackCard onOpenPool={onOpenCourses} />
    </section>
  );
}
