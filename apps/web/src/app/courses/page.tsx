'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CandidateTopBar } from '@/components/CandidatePortal';
import { COURSE_CATALOG } from '@/lib/courses';
import { getStoredUser } from '@/lib/session';
import { logout } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function CoursePoolPage() {
  const router = useRouter();
  const user = getStoredUser();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('All');

  const tags = useMemo(
    () => ['All', ...Array.from(new Set(COURSE_CATALOG.map((item) => item.tag)))],
    [],
  );

  const items = COURSE_CATALOG.filter((item) => {
    const matchesTag = tag === 'All' || item.tag === tag;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.provider.toLowerCase().includes(q) ||
      item.blurb.toLowerCase().includes(q);
    return matchesTag && matchesQuery;
  });

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
            <p className="mt-1 text-sm text-muted">Browse learning paths — dummy catalogue for now.</p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search courses"
            className="h-10 w-full max-w-xs rounded-full border border-primary/15 bg-white px-4 text-sm outline-none focus:border-teal"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((item) => (
            <button
              key={item}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                tag === item ? 'bg-primary text-white' : 'bg-white text-primary border border-primary/10'
              }`}
              onClick={() => setTag(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="cb-course-grid">
          {items.map((course) => (
            <article key={course.id} className="cb-course-grid-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={course.image} alt="" />
              <div className="cb-course-grid-body">
                <p className="cb-course-stack-tag">{course.tag}</p>
                <h2>{course.title}</h2>
                <p>{course.blurb}</p>
                <div className="cb-course-grid-meta">
                  <span>
                    {course.provider} · {course.duration}
                  </span>
                  <strong>{course.priceLabel}</strong>
                </div>
                <button type="button" className="cb-course-grid-cta">
                  View course
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
