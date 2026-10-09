'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

type JobRoleComboboxProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showHint?: boolean;
  required?: boolean;
  loading?: boolean;
  invalid?: boolean;
  describedBy?: string;
};

export function JobRoleCombobox({
  value,
  options,
  onChange,
  label = 'Job Role',
  placeholder = 'Search or type your job role…',
  showHint = true,
  required = false,
  loading = false,
  invalid = false,
  describedBy,
}: JobRoleComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const trimmed = query.trim();

  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    const unique = [...new Set(options.map((item) => item.trim()).filter(Boolean))];
    if (!q) return unique.slice(0, 12);
    return unique.filter((item) => item.toLowerCase().includes(q)).slice(0, 12);
  }, [options, trimmed]);

  const exactMatch = options.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  const canUseCustom = trimmed.length >= 2 && !exactMatch;
  const dropdownOptions = canUseCustom ? [...filtered, `__custom__:${trimmed}`] : filtered;

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(next: string) {
    const role = next.startsWith('__custom__:') ? next.slice('__custom__:'.length).trim() : next;
    if (!role) return;
    onChange(role);
    setQuery(role);
    setOpen(false);
    setHighlight(0);
  }

  function commitTypedValue() {
    if (!trimmed) return;
    pick(canUseCustom ? `__custom__:${trimmed}` : trimmed);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(dropdownOptions.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (open && dropdownOptions.length > 0) {
        pick(dropdownOptions[highlight]);
      } else {
        commitTypedValue();
      }
      return;
    }
    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label htmlFor={`${listId}-input`} className="mb-2 block text-sm font-bold text-[#0b1b5c]">
          {label}
          {required ? (
            <span className="ml-0.5 text-red-700" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}

      <div
        className={`flex min-h-12 items-center gap-2 rounded-xl border bg-white px-3.5 focus-within:border-[var(--color-primary)] focus-within:ring-[3px] focus-within:ring-[#c7d2ff] ${
          invalid ? 'border-red-600' : 'border-[#d7e1fa]'
        }`}
      >
        <span className="text-[#53689f]" aria-hidden>
          ⌕
        </span>
        <input
          id={`${listId}-input`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlight(0);
            onChange(event.target.value.trim());
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (trimmed !== value) onChange(trimmed);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-busy={loading || undefined}
          className="w-full border-none bg-transparent text-sm font-semibold text-[#0b1b5c] outline-none"
        />
      </div>

      {open && (loading || dropdownOptions.length > 0 || trimmed) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#d7e1fa] bg-white py-1 shadow-[0_14px_36px_rgba(16,19,124,0.18)]"
        >
          {loading ? (
            <li className="space-y-2 px-3 py-2" aria-label="Loading job roles">
              {[0, 1, 2].map((i) => (
                <span key={i} className="block h-4 animate-pulse rounded bg-[#e9efff]" />
              ))}
            </li>
          ) : dropdownOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#53689f]">Press Enter to use &ldquo;{trimmed}&rdquo;</li>
          ) : (
            dropdownOptions.map((option, index) => {
              const isCustom = option.startsWith('__custom__:');
              const labelText = isCustom ? `Use "${option.slice('__custom__:'.length)}"` : option;
              return (
                <li
                  key={option}
                  role="option"
                  aria-selected={index === highlight}
                  className={`cursor-pointer px-3 py-2 text-sm font-semibold ${
                    index === highlight ? 'bg-[#f0f4ff] text-[var(--color-primary-dark)]' : 'text-[#0b1b5c]'
                  } ${isCustom ? 'border-t border-[#d7e1fa] text-[var(--color-primary)]' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(option);
                  }}
                >
                  {labelText}
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {showHint ? (
        <p className="mt-2 text-xs text-[#53689f]">Search from the list or type any job role.</p>
      ) : null}
    </div>
  );
}
