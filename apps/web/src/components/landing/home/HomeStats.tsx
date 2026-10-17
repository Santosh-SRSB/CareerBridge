"use client";

import { useEffect, useState } from "react";
import { getPlatformStats } from "@/lib/api";
import { BriefcaseIcon, MapPinIcon, UserIcon } from "./icons";

type Stats = { jobs: number; passports: number; cities: number };

const ITEMS = [
  { key: "jobs", label: "Jobs", Icon: BriefcaseIcon },
  { key: "passports", label: "Candidates", Icon: UserIcon },
  { key: "cities", label: "Cities", Icon: MapPinIcon },
] as const;

const formatCount = new Intl.NumberFormat("en-IN");

function toCount(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** Live platform counts from the public stats endpoint; hidden if the request fails. */
export function HomeStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPlatformStats()
      .then((data) => {
        if (cancelled) return;
        setStats({
          jobs: toCount(data.jobs),
          passports: toCount(data.passports),
          cities: toCount(data.cities),
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;

  return (
    <section className="hl-stats" aria-label="CareerBridge in numbers" aria-busy={!stats}>
      <ul className="hl-stats__list">
        {ITEMS.map(({ key, label, Icon }) => (
          <li key={key} className="hl-stat">
            <span className="hl-stat__icon">
              <Icon size={24} />
            </span>
            <span className="hl-stat__text">
              <b>{stats ? formatCount.format(stats[key]) : "—"}</b>
              <span className="hl-stat__label">{label}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
