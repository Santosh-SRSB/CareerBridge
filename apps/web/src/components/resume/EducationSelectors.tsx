'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { DEGREE_OPTIONS, FIELD_OF_STUDY_OPTIONS } from '@/data/degree-options';
import { INSTITUTION_OPTIONS } from '@/data/institutions';
import {
  INDIA_STATES,
  formatCityState,
  getCitiesForState,
  parseCityState,
} from '@/data/india-locations';

const styles = `
  .cb-combo { position: relative; width: 100%; }
  .cb-combo-input-wrap {
    display: flex; align-items: center; gap: 8px;
    border: 1.5px solid var(--line, #dde0d3); border-radius: 8px;
    padding: 9px 11px; background: #fff;
  }
  .cb-combo-input-wrap:focus-within {
    border-color: #142a4f; box-shadow: 0 0 0 3px rgba(20, 42, 79, 0.08);
  }
  .cb-combo-input {
    flex: 1; border: none; outline: none; font-size: 13px;
    font-family: 'Inter', sans-serif; background: transparent; min-width: 0;
  }
  .cb-combo-dropdown {
    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
    max-height: 220px; overflow-y: auto; background: #fff;
    border: 1.5px solid #dde0d3; border-radius: 10px;
    box-shadow: 0 8px 24px -8px rgba(20, 42, 79, 0.2);
    z-index: 50; list-style: none; margin: 0; padding: 6px 0;
  }
  .cb-combo-option {
    padding: 9px 14px; font-size: 13px; cursor: pointer; color: #142a4f;
  }
  .cb-combo-option:hover, .cb-combo-option.highlighted { background: #f3f4ee; }
  .cb-combo-option.add-custom { color: #2e7d63; font-weight: 600; border-top: 1px solid #eef0ea; }
  .cb-form-select {
    border: 1.5px solid var(--line, #dde0d3); border-radius: 8px;
    padding: 9px 11px; font-size: 13px; font-family: 'Inter', sans-serif;
    width: 100%; box-sizing: border-box; background: #fff; color: #142a4f;
  }
  .cb-form-select:disabled { background: #f5f5f3; color: #9aa3b2; cursor: not-allowed; }
  .cb-location-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 600px) {
    .cb-location-pair { grid-template-columns: 1fr; }
  }
`;

interface SearchableComboboxProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
}

export function SearchableCombobox({
  label,
  value,
  onChange,
  options,
  placeholder = 'Search or type…',
  allowCustom = true,
  disabled = false,
}: SearchableComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 15);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 15);
  }, [query, options]);

  const trimmed = query.trim();
  const canAddCustom =
    allowCustom &&
    trimmed.length > 0 &&
    !options.some((o) => o.toLowerCase() === trimmed.toLowerCase());

  const listOptions = canAddCustom ? [...filtered, `__add__:${trimmed}`] : filtered;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(listOptions.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && listOptions.length > 0) pick(listOptions[highlight]);
      else if (trimmed) pick(canAddCustom ? `__add__:${trimmed}` : trimmed);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="cb-combo cb-field" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      {label ? <label>{label}</label> : null}
      <div className="cb-combo-input-wrap">
        <input
          className="cb-combo-input"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => !disabled && setOpen(true)}
          onBlur={() => {
            if (allowCustom && query.trim() && query !== value) onChange(query.trim());
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
        />
      </div>
      {open && !disabled && listOptions.length > 0 && (
        <ul className="cb-combo-dropdown" id={listId} role="listbox">
          {listOptions.map((opt, i) => {
            const isAdd = opt.startsWith('__add__:');
            const text = isAdd ? `Add "${opt.slice('__add__:'.length)}"` : opt;
            return (
              <li
                key={opt}
                role="option"
                className={`cb-combo-option ${i === highlight ? 'highlighted' : ''} ${isAdd ? 'add-custom' : ''}`}
                onMouseEnter={() => setHighlight(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(opt);
                }}
              >
                {text}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface DegreeSelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function DegreeSelect({ value, onChange, label = 'Degree / qualification *' }: DegreeSelectProps) {
  const [selectValue, setSelectValue] = useState('');
  const [customDegree, setCustomDegree] = useState('');

  useEffect(() => {
    if (!value) {
      setSelectValue('');
      setCustomDegree('');
      return;
    }
    if ((DEGREE_OPTIONS as readonly string[]).includes(value)) {
      setSelectValue(value);
      setCustomDegree('');
    } else {
      setSelectValue('Other (specify)');
      setCustomDegree(value);
    }
  }, [value]);

  function handleSelectChange(next: string) {
    setSelectValue(next);
    if (next === 'Other (specify)') {
      onChange(customDegree);
    } else {
      setCustomDegree('');
      onChange(next);
    }
  }

  return (
    <div className="cb-field">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <label>{label}</label>
      <select
        className="cb-form-select"
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        <option value="">Select degree</option>
        {DEGREE_OPTIONS.map((deg) => (
          <option key={deg} value={deg}>
            {deg}
          </option>
        ))}
      </select>
      {selectValue === 'Other (specify)' && (
        <input
          style={{ marginTop: 8 }}
          value={customDegree}
          onChange={(e) => {
            setCustomDegree(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Enter your degree"
        />
      )}
    </div>
  );
}

interface FieldOfStudySelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function FieldOfStudySelect({ value, onChange }: FieldOfStudySelectProps) {
  const [selectValue, setSelectValue] = useState('');
  const [customField, setCustomField] = useState('');

  useEffect(() => {
    if (!value) {
      setSelectValue('');
      setCustomField('');
      return;
    }
    if ((FIELD_OF_STUDY_OPTIONS as readonly string[]).includes(value)) {
      setSelectValue(value);
      setCustomField('');
    } else {
      setSelectValue('Other (specify)');
      setCustomField(value);
    }
  }, [value]);

  function handleSelectChange(next: string) {
    setSelectValue(next);
    if (next === 'Other (specify)') {
      onChange(customField);
    } else {
      setCustomField('');
      onChange(next);
    }
  }

  return (
    <div className="cb-field">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <label>Field of study</label>
      <select
        className="cb-form-select"
        value={selectValue}
        onChange={(e) => handleSelectChange(e.target.value)}
      >
        <option value="">Select field (optional)</option>
        {FIELD_OF_STUDY_OPTIONS.map((field) => (
          <option key={field} value={field}>
            {field}
          </option>
        ))}
      </select>
      {selectValue === 'Other (specify)' && (
        <input
          style={{ marginTop: 8 }}
          value={customField}
          onChange={(e) => {
            setCustomField(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="Enter field of study"
        />
      )}
    </div>
  );
}

export function InstitutionCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SearchableCombobox
      label="Institution"
      value={value}
      onChange={onChange}
      options={INSTITUTION_OPTIONS}
      placeholder="Search college or university"
      allowCustom
    />
  );
}

interface StateCitySelectProps {
  location: string;
  onChange: (location: string) => void;
  stateLabel?: string;
  cityLabel?: string;
}

export function StateCitySelect({
  location,
  onChange,
  stateLabel = 'State',
  cityLabel = 'City',
}: StateCitySelectProps) {
  const parsed = parseCityState(location);
  const [state, setState] = useState(parsed.state);
  const [city, setCity] = useState(parsed.city);

  useEffect(() => {
    const p = parseCityState(location);
    setState(p.state);
    setCity(p.city);
  }, [location]);

  const cities = useMemo(() => getCitiesForState(state), [state]);

  function update(nextState: string, nextCity: string) {
    setState(nextState);
    setCity(nextCity);
    onChange(formatCityState(nextCity, nextState));
  }

  return (
    <div className="cb-state-city-wrap" style={{ display: 'contents' }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <div className="cb-field">
        <label>{stateLabel}</label>
        <select
          className="cb-form-select"
          value={state}
          onChange={(e) => update(e.target.value, '')}
        >
          <option value="">Select state</option>
          {INDIA_STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <SearchableCombobox
        label={cityLabel}
        value={city}
        onChange={(nextCity) => update(state, nextCity)}
        options={cities}
        placeholder={state ? 'Search or type city' : 'Search or type city'}
        allowCustom
        disabled={!state && !city.trim()}
      />
    </div>
  );
}

export { formatCityState, parseCityState };
