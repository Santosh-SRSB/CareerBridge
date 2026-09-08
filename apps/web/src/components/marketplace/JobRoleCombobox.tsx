'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

type JobRoleComboboxProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function JobRoleCombobox({
  value,
  options,
  onChange,
  label = 'Job Role',
  placeholder = 'Search or type your job role…',
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
        <label htmlFor={`${listId}-input`} className="mb-2 block text-sm font-bold text-slate-800">
          {label}
        </label>
      ) : null}

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-[#0a2e2c]">
        <span className="text-slate-400" aria-hidden>
          ⌕
        </span>
        <input
          id={`${listId}-input`}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setHighlight(0);
            if (event.target.value.trim()) onChange(event.target.value.trim());
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (trimmed && trimmed !== value) onChange(trimmed);
            }, 120);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="w-full border-none bg-transparent text-sm font-semibold text-slate-800 outline-none"
        />
      </div>

      {open && (dropdownOptions.length > 0 || trimmed) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {dropdownOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">Press Enter to use &ldquo;{trimmed}&rdquo;</li>
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
                    index === highlight ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
                  } ${isCustom ? 'border-t border-slate-100 text-[#0a2e2c]' : ''}`}
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

      <p className="mt-2 text-xs text-slate-500">Search from the list or type any job role.</p>
    </div>
  );
}
