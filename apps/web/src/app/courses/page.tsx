'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CandidateTopBar } from '@/components/CandidatePortal';
import { getStoredUser } from '@/lib/session';
import { logout, recommendedCourses, type RecommendedCourse } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function CoursePoolPage() {
  const router = useRouter();
  const user = getStoredUser();
  const [query, setQuery] = useState('');
  const [courses, setCourses] = useState<RecommendedCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void recommendedCourses(24)
      .then((res) => {
        if (!cancelled) setCourses(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.provider.toLowerCase().includes(q) ||
        (item.instructor ?? '').toLowerCase().includes(q) ||
        item.blurb.toLowerCase().includes(q) ||
        item.matchedSkill.toLowerCase().includes(q),
    );
  }, [courses, query]);

  async function signOut() {
    await logout();
    router.replace('/');
  }

  return (
    <div className="cb-portal-page">
      <CandidateTopBar name={user?.firstName || 'Candidate'} onSignOut={signOut} />
      <div className="cb-portal-wrap space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/dashboard" className="text-sm font-semibold text-teal hover:underline">
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-extrabold text-primary sm:text-3xl">Course Pool</h1>
            <p className="mt-1 text-sm text-muted">
              Udemy recommendations matched to your resume skills (via Impact).
            </p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses"
            className="h-10 w-full max-w-xs rounded-full border border-primary/15 bg-white px-4 text-sm outline-none focus:border-teal"
          />
        </div>

        {loading ? <p className="text-sm text-muted">Loading recommendations…</p> : null}

        {!loading && !items.length ? (
          <p className="text-sm text-muted">No course matches yet. Add skills to your resume to get suggestions.</p>
        ) : null}

        <div className="cb-course-grid">
          {items.map((course) => (
            <article key={course.id} className="cb-course-grid-card">
              <div className="cb-course-grid-card__media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={course.imageUrl || '/window.svg'} alt="" />
                {course.instructorImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cb-course-grid-card__teacher" src={course.instructorImageUrl} alt="" />
                ) : null}
              </div>
              <div className="cb-course-grid-body">
                <p className="cb-course-stack-tag">{course.matchedSkill || course.provider}</p>
                <h2>{course.title}</h2>
                <p>{course.blurb}</p>
                <div className="cb-course-grid-meta">
                  <span>
                    {course.instructor || course.provider} · {course.duration}
                  </span>
                  <strong>{course.priceLabel}</strong>
                </div>
                <a
                  href={course.url}
                  target="_blank"
                  rel="noreferrer"
                  className="cb-course-grid-cta"
                >
                  Get on Udemy
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
