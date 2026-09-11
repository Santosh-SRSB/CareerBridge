'use client';

import { formatMonthRange, formatEducationYearRange } from '@/lib/resume-dates';

const fieldStyles = `
  .cb-date-field input[type="month"] {
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
  .cb-date-field input[type="month"]:focus {
    outline: none;
    border-color: #0A2E2C;
    box-shadow: 0 0 0 3px rgba(10, 46, 44, 0.25);
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
    gap: 8px;
    font-size: 13px;
    color: #6B6355;
    font-family: var(--font-inter), Inter, sans-serif;
  }
  .cb-date-range .cb-present-row input { width: auto; }
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
      <input id={id} type="month" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function MonthRangeFields({
  startLabel = 'Start date',
  endLabel = 'End date',
  start,
  end,
  isCurrent,
  onStartChange,
  onEndChange,
  onCurrentChange,
  showPresent = true,
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
}) {
  return (
    <div className="cb-date-range cb-date-field">
      <style dangerouslySetInnerHTML={{ __html: fieldStyles }} />
      <div className="cb-field">
        <label>{startLabel}</label>
        <input type="month" value={start} onChange={(e) => onStartChange(e.target.value)} />
      </div>
      <div className="cb-field">
        <label>{endLabel}</label>
        <input type="month" value={end} onChange={(e) => onEndChange(e.target.value)} disabled={isCurrent} />
      </div>
      {showPresent && (
        <label className="cb-present-row">
          <input type="checkbox" checked={isCurrent} onChange={(e) => onCurrentChange(e.target.checked)} />
          Currently working / studying here
        </label>
      )}
    </div>
  );
}

export { formatMonthRange, formatEducationYearRange };
