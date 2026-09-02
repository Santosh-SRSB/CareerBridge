"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const YEAR_START = 1970;
const YEAR_END = new Date().getFullYear() + 8;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: match[3] ? Number(match[3]) : 1,
  };
}

function formatDisplay(value: string) {
  const parsed = parseValue(value);
  if (!parsed) return "";
  return `${pad(parsed.day)} ${MONTHS[parsed.month].slice(0, 3)} ${parsed.year}`;
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { year: number; month: number; day: number; inMonth: boolean }[] = [];

  for (let index = 0; index < startWeekday; index += 1) {
    const date = new Date(year, month, index - startWeekday + 1);
    cells.push({ year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), inMonth: false });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({ year, month, day, inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, next);
    cells.push({ year: date.getFullYear(), month: date.getMonth(), day: date.getDate(), inMonth: false });
    next += 1;
  }
  return cells;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  emptyClass,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyClass?: string;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [pos, setPos] = useState({ left: 0, bottom: 0 });

  const cells = useMemo(() => monthCells(viewYear, viewMonth), [viewMonth, viewYear]);
  const years = useMemo(
    () => Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, index) => YEAR_START + index),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const next = parseValue(value);
    setViewYear(next?.year ?? now.getFullYear());
    setViewMonth(next?.month ?? now.getMonth());

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      setPos({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        bottom: window.innerHeight - rect.top + 8,
      });
    };
    place();

    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, value]);

  const calendar = open
    ? createPortal(
        <div
          ref={cardRef}
          className="date-picker-card"
          style={{ left: pos.left, bottom: pos.bottom }}
        >
          <div className="date-picker-head">
            <p>Select Date</p>
            <span className="date-picker-badge" aria-hidden="true">
              01
            </span>
          </div>

          <div className="date-picker-selects">
            <select value={viewMonth} onChange={(event) => setViewMonth(Number(event.target.value))}>
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <select value={viewYear} onChange={(event) => setViewYear(Number(event.target.value))}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="date-picker-week">
            {WEEKDAYS.map((day) => (
              <span key={day} className={day === "SUN" ? "is-sun" : ""}>
                {day}
              </span>
            ))}
          </div>

          <div className="date-picker-grid">
            {cells.map((cell, index) => {
              const iso = toIso(cell.year, cell.month, cell.day);
              const sunday = index % 7 === 0;
              return (
                <button
                  key={`${iso}-${index}`}
                  type="button"
                  className={[
                    "date-picker-day",
                    cell.inMonth ? "" : " is-muted",
                    sunday && cell.inMonth ? " is-sun" : "",
                    value === iso ? " is-selected" : "",
                  ].join("")}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                >
                  {pad(cell.day)}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`date-picker-trigger${emptyClass ?? ""}${open ? " is-open" : ""}`}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span>{formatDisplay(value) || placeholder}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8 3v4M16 3v4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      </button>
      {calendar}
    </div>
  );
}
