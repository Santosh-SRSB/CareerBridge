'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { INDIA_STATES, getCitiesForState } from '@/data/india-locations';

type ComboOption = { value: string; label: string; pinned?: boolean };

const OTHERS = '__others';

function ComboIcon({ children }: { children: ReactNode }) {
  return (
    <svg className="jb-ic" viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

function SearchCombo({
  id,
  label,
  placeholder,
  searchPlaceholder,
  icon,
  value,
  display,
  options,
  disabled,
  disabledHint,
  onSelect,
  edge,
}: {
  id: string;
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  icon: ReactNode;
  value: string;
  display: string;
  options: ComboOption[];
  disabled?: boolean;
  disabledHint?: string;
  onSelect: (value: string) => void;
  edge?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const labelId = `${id}-label`;
  const listId = `${id}-list`;

  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => !o.pinned && o.label.toLowerCase().includes(q)) : options;

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function openPanel() {
    setQuery('');
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  }

  function close(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function choose(index: number) {
    const option = visible[index];
    if (!option) return;
    onSelect(option.value);
    close(true);
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={`jb-cell${edge ? ' jb-cell--edge' : ''}`} ref={rootRef}>
      <span className="jb-lbl" id={labelId}>
        {label}
      </span>
      <div className="jb-combo">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          className="jb-trig"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${labelId} ${id}`}
          disabled={disabled}
          title={disabled ? disabledHint : undefined}
          onClick={() => (open ? close(false) : openPanel())}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && !open) {
              event.preventDefault();
              openPanel();
            }
          }}
        >
          {icon}
          <span className={display ? 'jb-val' : 'jb-val jb-val--ph'}>{display || placeholder}</span>
          <svg className="jb-ic jb-chev" viewBox="0 0 24 24" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {open ? (
          <div className="jb-panel">
            <div className="jb-psearch">
              <svg className="jb-ic jb-ic--sm" viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={visible[active] ? `${id}-o${active}` : undefined}
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                autoComplete="off"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
              />
            </div>
            <ul className="jb-opts" id={listId} role="listbox" aria-label={label} ref={listRef}>
              {visible.length ? (
                visible.map((option, index) => (
                  <li
                    key={option.value || '__all'}
                    id={`${id}-o${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    className={index === active ? 'jb-opt jb-opt--act' : 'jb-opt'}
                    onMouseMove={() => setActive(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(index)}
                  >
                    {option.label}
                  </li>
                ))
              ) : (
                <li className="jb-opt jb-opt--none" role="presentation">
                  No matches
                </li>
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function JobLocationFields({
  state,
  city,
  onStateChange,
  onCityChange,
}: {
  state: string;
  city: string;
  onStateChange: (state: string) => void;
  onCityChange: (city: string) => void;
}) {
  const uid = useId().replace(/:/g, '');
  const cities = useMemo(() => getCitiesForState(state), [state]);
  const [otherMode, setOtherMode] = useState(() => Boolean(city) && !cities.includes(city));
  const otherRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otherMode) otherRef.current?.focus();
  }, [otherMode]);

  const stateOptions: ComboOption[] = [
    { value: '', label: 'All states', pinned: true },
    ...INDIA_STATES.map((item) => ({ value: item, label: item })),
  ];
  const cityOptions: ComboOption[] = state
    ? [
        { value: '', label: 'All cities in state', pinned: true },
        ...cities.map((item) => ({ value: item, label: item })),
        { value: OTHERS, label: 'Others' },
      ]
    : [];

  const stateIcon = (
    <ComboIcon>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </ComboIcon>
  );
  const cityIcon = (
    <ComboIcon>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </ComboIcon>
  );

  return (
    <div className="jb-locfields">
      <SearchCombo
        id={`job-state-${uid}`}
        label="State"
        placeholder="State"
        searchPlaceholder="Search state..."
        icon={stateIcon}
        value={state}
        display={state}
        options={stateOptions}
        onSelect={(next) => {
          setOtherMode(false);
          onStateChange(next);
          onCityChange('');
        }}
      />

      {otherMode ? (
        <div className="jb-cell jb-cell--edge">
          <label className="jb-lbl" htmlFor={`job-city-other-${uid}`}>
            Enter city manually
          </label>
          <div className="jb-fld">
            {cityIcon}
            <input
              ref={otherRef}
              id={`job-city-other-${uid}`}
              value={city}
              onChange={(event) => onCityChange(event.target.value)}
              placeholder="Type your city"
              autoComplete="off"
            />
            <button
              type="button"
              className="jb-fld-x"
              aria-label="Back to city list"
              onClick={() => {
                setOtherMode(false);
                onCityChange('');
              }}
            >
              <svg className="jb-ic jb-ic--sm" viewBox="0 0 24 24" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <SearchCombo
          id={`job-city-${uid}`}
          label="City (optional)"
          placeholder="City (optional)"
          searchPlaceholder="Search city..."
          icon={cityIcon}
          value={city}
          display={city}
          options={cityOptions}
          disabled={!state}
          disabledHint="Select a state first"
          edge
          onSelect={(next) => {
            if (next === OTHERS) {
              setOtherMode(true);
              onCityChange('');
              return;
            }
            onCityChange(next);
          }}
        />
      )}
    </div>
  );
}
