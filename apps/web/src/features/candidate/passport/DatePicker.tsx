'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
/** Monday-first to match design. */
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const YEAR_START = 1970;
const YEAR_END = new Date().getFullYear() + 8;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function toMonthIso(year: number, month: number) {
  return `${year}-${pad(month + 1)}`;
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

function formatDisplay(value: string, mode: 'date' | 'month') {
  const parsed = parseValue(value);
  if (!parsed) return '';
  if (mode === 'month') {
    return `${MONTHS[parsed.month].slice(0, 3)} ${parsed.year}`;
  }
  return `${pad(parsed.day)} ${MONTHS[parsed.month].slice(0, 3)} ${parsed.year}`;
}

/** Monday-first month grid. */
function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startWeekday = (first.getDay() + 6) % 7; // Mon=0 … Sun=6
  const days = new Date(year, month + 1, 0).getDate();
  const cells: { year: number; month: number; day: number; inMonth: boolean }[] = [];

  for (let index = 0; index < startWeekday; index += 1) {
    const date = new Date(year, month, index - startWeekday + 1);
    cells.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      inMonth: false,
    });
  }
  for (let day = 1; day <= days; day += 1) {
    cells.push({ year, month, day, inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    const date = new Date(year, month + 1, next);
    cells.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      inMonth: false,
    });
    next += 1;
  }
  return cells;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  emptyClass,
  disabled,
  mode = 'date',
  confirmLabel = 'Set date',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyClass?: string;
  disabled?: boolean;
  /** `month` stores/returns YYYY-MM; `date` stores YYYY-MM-DD. */
  mode?: 'date' | 'month';
  confirmLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(parsed?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? today.getMonth());
  const [draftDay, setDraftDay] = useState(parsed?.day ?? today.getDate());
  const [pos, setPos] = useState({ left: 0, top: 0 });

  const cells = useMemo(() => monthCells(viewYear, viewMonth), [viewMonth, viewYear]);
  const years = useMemo(
    () => Array.from({ length: YEAR_END - YEAR_START + 1 }, (_, index) => YEAR_START + index).reverse(),
    [],
  );

  const draftIso =
    mode === 'month'
      ? toMonthIso(viewYear, viewMonth)
      : toIso(viewYear, viewMonth, draftDay);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const next = parseValue(value);
    setViewYear(next?.year ?? now.getFullYear());
    setViewMonth(next?.month ?? now.getMonth());
    setDraftDay(next?.day ?? now.getDate());

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const cardHeight = 420;
      const spaceBelow = window.innerHeight - rect.bottom;
      const openAbove = spaceBelow < cardHeight && rect.top > spaceBelow;
      setPos({
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
        top: openAbove
          ? Math.max(12, rect.top - cardHeight - 8)
          : Math.min(rect.bottom + 8, window.innerHeight - cardHeight - 12),
      });
    };
    place();

    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || cardRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open, value]);

  const calendar = open
    ? createPortal(
        <div
          ref={cardRef}
          className="date-picker-card"
          style={{ left: pos.left, top: pos.top }}
          role="dialog"
          aria-label={confirmLabel}
        >
          <div className="date-picker-selects">
            <select
              value={viewMonth}
              onChange={(event) => setViewMonth(Number(event.target.value))}
              aria-label="Month"
            >
              {MONTHS.map((month, index) => (
                <option key={month} value={index}>
                  {month}
                </option>
              ))}
            </select>
            <select
              value={viewYear}
              onChange={(event) => setViewYear(Number(event.target.value))}
              aria-label="Year"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {mode === 'date' ? (
            <>
              <div className="date-picker-week">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>

              <div className="date-picker-grid">
                {cells.map((cell, index) => {
                  const iso = toIso(cell.year, cell.month, cell.day);
                  const isSelected =
                    cell.inMonth &&
                    draftDay === cell.day &&
                    viewMonth === cell.month &&
                    viewYear === cell.year;
                  const isToday =
                    cell.inMonth &&
                    cell.day === today.getDate() &&
                    cell.month === today.getMonth() &&
                    cell.year === today.getFullYear();
                  return (
                    <button
                      key={`${iso}-${index}`}
                      type="button"
                      className={[
                        'date-picker-day',
                        cell.inMonth ? '' : ' is-muted',
                        isToday && !isSelected ? ' is-today' : '',
                        isSelected ? ' is-selected' : '',
                      ].join('')}
                      onClick={() => {
                        if (!cell.inMonth) {
                          setViewYear(cell.year);
                          setViewMonth(cell.month);
                        }
                        setDraftDay(cell.day);
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="date-picker-month-grid">
              {MONTHS.map((month, index) => (
                <button
                  key={month}
                  type="button"
                  className={`date-picker-month-cell${viewMonth === index ? ' is-selected' : ''}`}
                  onClick={() => setViewMonth(index)}
                >
                  {month.slice(0, 3)}
                </button>
              ))}
            </div>
          )}

          <div className="date-picker-actions">
            <button type="button" className="date-picker-btn date-picker-btn--ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="date-picker-btn date-picker-btn--primary"
              onClick={() => {
                onChange(draftIso);
                setOpen(false);
              }}
            >
              {confirmLabel}
            </button>
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
        className={`date-picker-trigger${emptyClass ?? ''}${open ? ' is-open' : ''}${!value ? ' is-empty' : ''}`}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev);
        }}
      >
        <span>{formatDisplay(value, mode) || placeholder}</span>
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
