"use client";

import { useMemo, useState } from "react";

export function SearchSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  emptyClass,
  freeText = false,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  emptyClass?: string;
  freeText?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const shown = open && !freeText ? query : value;

  const matches = useMemo(() => {
    const term = shown.trim().toLowerCase();
    const list = term
      ? options.filter((item) => item.toLowerCase().includes(term))
      : options;
    return list.slice(0, 40);
  }, [options, shown]);

  return (
    <label className={`passport-field relative${label ? "" : " no-label"}`}>
      {label ? label : null}
      <input
        className={emptyClass}
        value={shown}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setQuery(value);
          setOpen(true);
        }}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          if (freeText) onChange(next);
        }}
        onBlur={() => {
          if (freeText && query.trim() && query !== value) onChange(query.trim());
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open ? (
        <ul className="search-select-menu">
          {matches.map((item) => (
            <li key={item}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item);
                  setQuery(item);
                  setOpen(false);
                }}
              >
                {item}
              </button>
            </li>
          ))}
          {query.trim() &&
          !freeText &&
          !options.some((item) => item.toLowerCase() === query.trim().toLowerCase()) ? (
            <li>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(query.trim());
                  setOpen(false);
                }}
              >
                Use “{query.trim()}”
              </button>
            </li>
          ) : null}
          {!matches.length && !query.trim() ? <li className="search-select-empty">No matches</li> : null}
        </ul>
      ) : null}
    </label>
  );
}
