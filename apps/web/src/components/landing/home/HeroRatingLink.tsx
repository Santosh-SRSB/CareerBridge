"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listPublicTestimonials } from "@/lib/api";

type Summary = { average: number; count: number };

function summarize(rows: Array<{ rating: number }>): Summary | null {
  if (!rows.length) return null;
  const total = rows.reduce((sum, row) => sum + (Number(row.rating) || 0), 0);
  const average = Math.round((total / rows.length) * 10) / 10;
  return { average, count: rows.length };
}

const reviewCount = new Intl.NumberFormat("en-IN");

/** Compact rating chip after Find Jobs — opens the public testimonials page. */
export function HeroRatingLink() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublicTestimonials()
      .then((rows) => {
        if (cancelled) return;
        setSummary(summarize(rows));
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) return null;

  const filled = Math.round(summary.average);

  return (
    <Link
      href="/testimonials"
      className="hl-hero__rating"
      aria-label={`${summary.average} out of 5 from ${summary.count} reviews. View testimonials.`}
    >
      <span className="hl-hero__rating-score">{summary.average.toFixed(1)}</span>
      <span className="hl-hero__rating-stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={index < filled ? "is-on" : undefined}>
            ★
          </span>
        ))}
      </span>
      <span className="hl-hero__rating-count">
        {reviewCount.format(summary.count)} {summary.count === 1 ? "review" : "reviews"}
      </span>
    </Link>
  );
}
