'use client';

import { formatMonthRange, formatEducationYearRange } from '@/lib/resume-dates';

/** Accept YYYY-MM-DD or legacy YYYY-MM for <input type="date">. */
function toDateInputValue(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  return '';
}

const fieldStyles = `
  .cb-date-field input[type="date"] {
    border: 2px solid #7A8270;
    border-radius: 0.5rem;
    padding: 10px 12px;
    font-size: 14px;
    font-family: var(--font-inter), Inter, sans-serif;
    width: 100%;
    box-sizing: border-box;
    color: #241C15;
    background: #fff;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .cb-date-field input[type="date"]:focus {
    outline: none;
    border-color: #0A2E2C;
    box-shadow: 0 0 0 3px rgba(10, 46, 44, 0.25);
  }
  .cb-date-field input[type="date"]:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .cb-date-range {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .cb-date-range .cb-present-row {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    font-weight: 600;
    color: #241C15;
    font-family: var(--font-inter), Inter, sans-serif;
    border: 1px solid rgba(10, 46, 44, 0.12);
    border-radius: 0.5rem;
    padding: 10px 12px;
    background: #fff;
    cursor: pointer;
  }
  .cb-date-range .cb-present-row input {
    width: auto;
    accent-color: #0a2e2c;
  }
  @media (max-width: 600px) {
    .cb-date-range { grid-template-columns: 1fr; }
  }
`;

export function MonthField({
  label,
  value,
  onChange,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <div className="cb-date-field cb-field">
      <style dangerouslySetInnerHTML={{ __html: fieldStyles }} />
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="date"
        value={toDateInputValue(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function MonthRangeFields({
  startLabel = 'From',
  endLabel = 'To',
  start,
  end,
  isCurrent,
  onStartChange,
  onEndChange,
  onCurrentChange,
  showPresent = true,
  presentLabel = 'I am working currently',
}: {
  startLabel?: string;
  endLabel?: string;
  start: string;
  end: string;
  isCurrent: boolean;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onCurrentChange: (v: boolean) => void;
  showPresent?: boolean;
  presentLabel?: string;
}) {
  return (
    <div className="cb-date-range cb-date-field">
      <style dangerouslySetInnerHTML={{ __html: fieldStyles }} />
      <div className="cb-field">
        <label>{startLabel}</label>
        <input
          type="date"
          value={toDateInputValue(start)}
          onChange={(e) => onStartChange(e.target.value)}
        />
      </div>
      <div className="cb-field">
        <label>{endLabel}</label>
        <input
          type="date"
          value={isCurrent ? '' : toDateInputValue(end)}
          onChange={(e) => onEndChange(e.target.value)}
          disabled={isCurrent}
        />
      </div>
      {showPresent ? (
        <label className="cb-present-row">
          <input
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => {
              onCurrentChange(e.target.checked);
              if (e.target.checked) onEndChange('');
            }}
          />
          {presentLabel}
        </label>
      ) : null}
    </div>
  );
}

export { formatMonthRange, formatEducationYearRange };
