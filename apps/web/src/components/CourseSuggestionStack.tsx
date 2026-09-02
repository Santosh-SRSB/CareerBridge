'use client';

import Link from 'next/link';
import { suggestedCourses, type CourseCard } from '@/lib/courses';

function CourseMiniCard({ course, index }: { course: CourseCard; index: number }) {
  return (
    <article className="cb-course-stack-card" style={{ ['--stack-i' as string]: index }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={course.image} alt="" className="cb-course-stack-img" />
      <div className="cb-course-stack-body">
        <p className="cb-course-stack-tag">{course.tag}</p>
        <h3>{course.title}</h3>
        <p>{course.blurb}</p>
        <span>
          {course.duration} · {course.level}
        </span>
      </div>
    </article>
  );
}

export function CourseSuggestionStack({ courses = suggestedCourses(3) }: { courses?: CourseCard[] }) {
  return (
    <section className="cb-course-stack" aria-label="Suggested courses">
      <div className="cb-course-stack-head">
        <p>Learn next</p>
        <h2>Course suggestions</h2>
      </div>
      <div className="cb-course-stack-stage">
        {courses.map((course, index) => (
          <CourseMiniCard key={course.id} course={course} index={index} />
        ))}
      </div>
      <Link href="/courses" className="cb-course-pool-btn">
        Course Pool
      </Link>
    </section>
  );
}
