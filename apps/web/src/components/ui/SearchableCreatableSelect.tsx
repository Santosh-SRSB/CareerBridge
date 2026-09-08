'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Searchable single-select with optional "add custom" when no list match.
 */
export function SearchableCreatableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search or select…',
  allowCustom = true,
  required = false,
  id,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  allowCustom?: boolean;
  required?: boolean;
  id?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const inputId = id || useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 20);
    return options.filter((item) => item.toLowerCase().includes(q)).slice(0, 20);
  }, [options, query]);

  const trimmed = query.trim();
  const canAddCustom =
    allowCustom &&
    trimmed.length > 0 &&
    !options.some((item) => item.toLowerCase() === trimmed.toLowerCase());

  const listOptions = canAddCustom ? [...filtered, `__add__:${trimmed}`] : filtered;

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(opt: string) {
    const next = opt.startsWith('__add__:') ? opt.slice('__add__:'.length) : opt;
    onChange(next);
    setQuery(next);
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(listOptions.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && listOptions.length > 0) pick(listOptions[highlight]);
      else if (trimmed) pick(canAddCustom ? `__add__:${trimmed}` : trimmed);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative block">
      <label htmlFor={inputId} className="mb-1.5 block text-xs font-bold text-primary">
        {label}
      </label>
      <input
        id={inputId}
        value={query}
        required={required && !value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
          if (!event.target.value.trim()) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          const next = query.trim();
          if (next && next !== value) onChange(next);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20"
      />
      {open && (listOptions.length > 0 || trimmed) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-primary/15 bg-white py-1 shadow-lg"
        >
          {listOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">
              {allowCustom ? `Press Enter to add “${trimmed}”` : 'No matches'}
            </li>
          ) : (
            listOptions.map((opt, index) => {
              const isAdd = opt.startsWith('__add__:');
              const labelText = isAdd ? `Add “${opt.slice('__add__:'.length)}”` : opt;
              return (
                <li key={opt} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    className={`flex w-full px-3 py-2 text-left text-sm ${
                      index === highlight ? 'bg-[#e8fbfa] font-semibold text-primary' : 'text-primary hover:bg-[#f6fbf7]'
                    } ${isAdd ? 'border-t border-primary/10 font-bold text-teal' : ''}`}
                    onMouseEnter={() => setHighlight(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      pick(opt);
                    }}
                  >
                    {labelText}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
      {required ? (
        <input tabIndex={-1} className="sr-only" required value={value} onChange={() => undefined} />
      ) : null}
    </div>
  );
}
