'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  filterLocationOptions,
  labelForLocationValue,
  type LocationOption,
} from '@/components/auth/location-options';

/**
 * Searchable city picker for auth forms. Value stays `State|City` for existing registration drafts/API.
 */
export function LocationSearchSelect({
  id,
  value,
  onChange,
  onBlur,
  required = false,
  placeholder = 'Search your city…',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  placeholder?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}) {
  const [query, setQuery] = useState(() => labelForLocationValue(value));
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQuery(labelForLocationValue(value));
  }, [value]);

  const filtered = useMemo(() => filterLocationOptions(query), [query]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery(labelForLocationValue(value));
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [value]);

  function pick(opt: LocationOption) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (open && filtered[highlight]) pick(filtered[highlight]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setQuery(labelForLocationValue(value));
    }
  }

  return (
    <div ref={rootRef} className="cb-location-search" style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        id={id}
        name="location-search"
        type="text"
        value={query}
        required={required && !value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          setHighlight(0);
          if (!next.trim()) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="cb-auth-field__input"
      />
      {open && filtered.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="cb-location-search__list"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 60,
            maxHeight: 224,
            overflowY: 'auto',
            margin: 0,
            padding: '6px 0',
            listStyle: 'none',
            background: '#fff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 12px 28px -10px rgba(15, 23, 42, 0.18)',
          }}
        >
          {filtered.map((opt, index) => (
            <li key={opt.value} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                className="cb-location-search__option"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '9px 14px',
                  border: 0,
                  background: index === highlight ? '#eef0ff' : 'transparent',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: index === highlight ? 600 : 500,
                  color: '#0f172a',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(opt);
                }}
              >
                <span style={{ display: 'block' }}>{opt.city}</span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#64748b' }}>
                  {opt.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : open && query.trim() ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 60,
            padding: '12px 14px',
            background: '#fff',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            boxShadow: '0 12px 28px -10px rgba(15, 23, 42, 0.18)',
            fontSize: 13,
            color: '#64748b',
          }}
        >
          No cities match “{query.trim()}”
        </div>
      ) : null}
      {required ? (
        <input
          tabIndex={-1}
          className="sr-only"
          aria-hidden="true"
          aria-label="Location"
          required
          value={value}
          onChange={() => undefined}
        />
      ) : null}
    </div>
  );
}
