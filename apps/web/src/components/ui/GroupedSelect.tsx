'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';

export type SelectGroup = {
  label?: string;
  options: readonly string[];
};

export function GroupedSelect({
  label,
  value,
  onChange,
  groups,
  allowAll = false,
  allLabel = 'All',
  placeholder = 'Select',
  required = false,
  otherInputLabel = 'Enter other',
  otherPlaceholder = 'Type here',
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: SelectGroup[];
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  required?: boolean;
  otherInputLabel?: string;
  otherPlaceholder?: string;
  id: string;
}) {
  const listed = groups.flatMap((group) => [...group.options]);
  const listedKey = listed.join('|');
  const isListed = listed.includes(value);
  const [otherMode, setOtherMode] = useState(() => Boolean(value) && !isListed);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (value && !listed.includes(value)) setOtherMode(true);
  }, [listedKey, value]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) => option.toLowerCase().includes(q)),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const display = otherMode ? 'Others' : value || (allowAll ? allLabel : placeholder);

  function pick(next: string, other = false) {
    setOtherMode(other);
    onChange(other ? (listed.includes(value) ? '' : value) : next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative min-w-0 space-y-2 ${open ? 'z-[90]' : 'z-20'}`}>
      <p className="mb-1.5 text-sm font-semibold text-primary">{label}</p>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-[#faf8f3] px-3.5 py-3 text-left text-sm text-primary outline-none transition duration-200 ease-out ${
          open
            ? 'border-teal/50 bg-white shadow-[0_0_0_3px_rgba(13,148,136,0.12)]'
            : 'border-primary/15 hover:border-teal/35 hover:bg-white'
        }`}
      >
        <span className={`truncate ${value || otherMode || allowAll ? 'font-medium' : 'text-muted'}`}>
          {display}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M5 7.5 10 12.5 15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div className="cb-select-menu absolute bottom-[calc(100%-0.15rem)] left-0 z-[80] mb-2 flex w-full flex-col-reverse overflow-hidden rounded-2xl border border-primary/12 bg-white shadow-[0_20px_48px_rgba(10,46,44,0.18)]">
          <div className="border-t border-primary/8 bg-fog/70 px-3 py-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-primary/10 bg-white px-3 py-2 shadow-sm">
              <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 20 20" fill="none" aria-hidden>
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-muted"
                aria-label={`Search ${label}`}
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto overscroll-contain py-1" role="listbox">
            {allowAll && !query.trim() ? (
              <button
                type="button"
                className={`flex w-full px-3.5 py-2.5 text-left text-sm transition duration-150 ease-out ${
                  !value && !otherMode
                    ? 'bg-[#e8fbfa] font-bold text-primary'
                    : 'text-primary hover:bg-[#f6fbf7]'
                }`}
                onClick={() => pick('')}
              >
                {allLabel}
              </button>
            ) : null}

            {filteredGroups.length === 0 ? (
              <p className="px-3.5 py-4 text-sm text-muted">No matches. Try another search.</p>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label || 'options'}>
                  {group.label ? (
                    <p className="sticky top-0 bg-[#f6fbf7]/95 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted backdrop-blur">
                      {group.label}
                    </p>
                  ) : null}
                  {group.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm transition duration-150 ease-out ${
                        !otherMode && value === option
                          ? 'bg-[#e8fbfa] font-bold text-primary'
                          : 'text-primary hover:bg-[#f6fbf7]'
                      }`}
                      onClick={() => pick(option)}
                    >
                      <span>{option}</span>
                      {!otherMode && value === option ? (
                        <svg className="h-4 w-4 text-teal" viewBox="0 0 20 20" fill="none" aria-hidden>
                          <path
                            d="M4.5 10.5 8 14l7.5-8"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))
            )}

            {!query.trim() ? (
              <button
                type="button"
                className={`flex w-full border-t border-primary/10 px-3.5 py-3 text-left text-sm font-bold transition duration-150 ease-out ${
                  otherMode ? 'bg-[#e8fbfa] text-primary' : 'text-primary hover:bg-[#f6fbf7]'
                }`}
                onClick={() => pick('', true)}
              >
                Others
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {otherMode ? (
        <Input
          label={otherInputLabel}
          name={`${id}-other`}
          required={required}
          value={isListed ? '' : value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={otherPlaceholder}
        />
      ) : required && !allowAll ? (
        <input tabIndex={-1} className="sr-only" required value={value} onChange={() => undefined} />
      ) : null}
    </div>
  );
}
