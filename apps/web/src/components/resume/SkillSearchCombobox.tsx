'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ALL_SKILL_OPTIONS } from '@/data/technology-skills';

const comboboxStyles = `
  .cb-skill-combo { position: relative; width: 100%; }
  .cb-skill-combo-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1.5px solid var(--line, #dde0d3);
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
  }
  .cb-skill-combo-input-wrap:focus-within {
    border-color: #142a4f;
    box-shadow: 0 0 0 3px rgba(20, 42, 79, 0.08);
  }
  .cb-skill-combo-input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    background: transparent;
    min-width: 0;
  }
  .cb-skill-combo-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 220px;
    overflow-y: auto;
    background: #fff;
    border: 1.5px solid #dde0d3;
    border-radius: 10px;
    box-shadow: 0 8px 24px -8px rgba(20, 42, 79, 0.2);
    z-index: 40;
    list-style: none;
    margin: 0;
    padding: 6px 0;
  }
  .cb-skill-combo-option {
    padding: 9px 14px;
    font-size: 13.5px;
    cursor: pointer;
    color: #142a4f;
  }
  .cb-skill-combo-option:hover,
  .cb-skill-combo-option.highlighted {
    background: #f3f4ee;
  }
  .cb-skill-combo-option.add-custom {
    color: #2e7d63;
    font-weight: 600;
    border-top: 1px solid #eef0ea;
  }
  .cb-skill-combo-empty {
    padding: 10px 14px;
    font-size: 13px;
    color: #6b7789;
  }
  .cb-skill-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .cb-skill-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    background: #142a4f;
    color: #fff;
    cursor: pointer;
  }
  .cb-skill-chip span { opacity: 0.85; font-size: 15px; line-height: 1; }
`;

interface SkillSearchComboboxProps {
  selected: string[];
  onAdd: (skill: string) => void;
  onRemove: (skill: string) => void;
  placeholder?: string;
  label?: string;
}

export function SkillSearchCombobox({
  selected,
  onAdd,
  onRemove,
  placeholder = 'Search technologies or type to add…',
  label = 'Skills',
}: SkillSearchComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const uniqueSelected = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const skill of selected) {
      const key = skill.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(skill.trim());
    }
    return out;
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const selectedLower = new Set(uniqueSelected.map((s) => s.toLowerCase()));
    const pool = ALL_SKILL_OPTIONS.filter((s) => !selectedLower.has(s.toLowerCase()));
    if (!q) return pool.slice(0, 12);
    return pool.filter((s) => s.toLowerCase().includes(q)).slice(0, 12);
  }, [query, uniqueSelected]);

  const trimmed = query.trim();
  const canAddCustom =
    trimmed.length > 0 &&
    !uniqueSelected.some((s) => s.toLowerCase() === trimmed.toLowerCase()) &&
    !ALL_SKILL_OPTIONS.some((s) => s.toLowerCase() === trimmed.toLowerCase());

  const options = canAddCustom
    ? [...filtered, `__add__:${trimmed}`]
    : filtered;

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(value: string) {
    const next = value.startsWith('__add__:') ? value.slice('__add__:'.length) : value;
    const trimmed = next.trim();
    if (
      !trimmed ||
      selected.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      setQuery('');
      setOpen(false);
      setHighlight(0);
      return;
    }
    onAdd(trimmed);
    setQuery('');
    setOpen(false);
    setHighlight(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && options.length > 0) {
        pick(options[highlight]);
      } else if (trimmed) {
        pick(canAddCustom ? `__add__:${trimmed}` : trimmed);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="cb-skill-combo" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: comboboxStyles }} />
      {label ? (
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#43526b' }}>
          {label}
        </label>
      ) : null}
      <div className="cb-skill-combo-input-wrap">
        <span aria-hidden style={{ opacity: 0.5 }}>⌕</span>
        <input
          className="cb-skill-combo-input"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
      </div>

      {open && (options.length > 0 || trimmed) && (
        <ul className="cb-skill-combo-dropdown" id={listId} role="listbox">
          {options.length === 0 ? (
            <li className="cb-skill-combo-empty">Press Enter to add &ldquo;{trimmed}&rdquo;</li>
          ) : (
            options.map((opt, i) => {
              const isAdd = opt.startsWith('__add__:');
              const labelText = isAdd ? `Add "${opt.slice('__add__:'.length)}"` : opt;
              return (
                <li
                  key={opt}
                  role="option"
                  aria-selected={i === highlight}
                  className={`cb-skill-combo-option ${i === highlight ? 'highlighted' : ''} ${isAdd ? 'add-custom' : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(opt);
                  }}
                >
                  {labelText}
                </li>
              );
            })
          )}
        </ul>
      )}

      {uniqueSelected.length > 0 && (
        <div className="cb-skill-chips">
          {uniqueSelected.map((s, index) => (
            <button
              key={`${s.toLowerCase()}::${index}`}
              type="button"
              className="cb-skill-chip"
              onClick={() => onRemove(s)}
            >
              {s} <span aria-label={`Remove ${s}`}>×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
