'use client';

import { useEffect, useRef, useState } from 'react';
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
  const rootRef = useRef<HTMLDivElement>(null);

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

  const display = otherMode ? 'Others' : value || (allowAll ? allLabel : placeholder);

  function pick(next: string, other = false) {
    setOtherMode(other);
    onChange(other ? (listed.includes(value) ? '' : value) : next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0 space-y-2">
      <p className="mb-1.5 text-sm font-semibold text-primary">{label}</p>
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-primary/15 bg-[#faf8f3] px-3 py-2.5 text-left text-sm text-primary outline-none"
      >
        <span className={`truncate ${value || otherMode || allowAll ? '' : 'text-muted'}`}>{display}</span>
        <span className="shrink-0 text-muted">Γû╛</span>
      </button>
      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-primary/15 bg-white shadow-[0_16px_40px_rgba(10,46,44,0.16)]">
          <div className="max-h-56 overflow-y-auto" role="listbox">
            {allowAll ? (
              <button
                type="button"
                className={`flex w-full px-3 py-2 text-left text-sm ${!value && !otherMode ? 'bg-[#e8fbfa] font-bold text-primary' : 'text-primary hover:bg-[#f6fbf7]'}`}
                onClick={() => pick('')}
              >
                {allLabel}
              </button>
            ) : null}
            {groups.map((group) => (
              <div key={group.label || 'options'}>
                {group.label ? (
                  <p className="sticky top-0 bg-[#f6fbf7] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">
                    {group.label}
                  </p>
                ) : null}
                {group.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`flex w-full px-3 py-2 text-left text-sm ${!otherMode && value === option ? 'bg-[#e8fbfa] font-bold text-primary' : 'text-primary hover:bg-[#f6fbf7]'}`}
                    onClick={() => pick(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            className={`flex w-full border-t border-primary/10 px-3 py-2.5 text-left text-sm font-bold ${otherMode ? 'bg-[#e8fbfa] text-primary' : 'text-primary hover:bg-[#f6fbf7]'}`}
            onClick={() => pick('', true)}
          >
            Others
          </button>
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
