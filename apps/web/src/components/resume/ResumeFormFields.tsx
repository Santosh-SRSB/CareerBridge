'use client';

import { useId } from 'react';
import { DatePicker } from '@/features/candidate/passport/DatePicker';
import { formatMonthRange, formatEducationYearRange } from '@/lib/resume-dates';

const fieldStyles = `
  .cb-date-field .date-picker-trigger {
    border: 2px solid #d1d5e5;
    border-radius: 0.5rem;
    min-height: 44px;
    padding: 10px 12px;
    font-size: 14px;
    font-family: var(--font-inter), Inter, sans-serif;
  }
  .cb-date-field .date-picker-trigger.is-open {
    border-color: #1A1FC4;
    box-shadow: 0 0 0 3px rgba(26, 31, 196, 0.25);
  }
  .cb-date-field .date-picker-trigger.is-invalid { border-color: #b42318; }
  .cb-date-error { margin: 4px 0 0; font-size: 12px; font-weight: 600; color: #b42318; }
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
  const generatedId = useId();
  const fieldId = id || generatedId;
  return (
    <div className="cb-date-field cb-field">
      <style dangerouslySetInnerHTML={{ __html: fieldStyles }} />
      <label htmlFor={fieldId}>{label}</label>
      <DatePicker
        id={fieldId}
        mode="month"
        value={value}
        onChange={onChange}
        placeholder="Select month"
        confirmLabel={label.toLowerCase().includes('end') ? 'Set end date' : 'Set start date'}
        disabled={false}
      />
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
  presentLabel = 'Currently working / studying here',
  startError,
  endError,
  maxYear,
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
  startError?: string;
  endError?: string;
  maxYear?: number;
}) {
  const baseId = useId();
  const startId = `${baseId}-start`;
  const endId = `${baseId}-end`;
  return (
    <div className="cb-date-range cb-date-field">
      <style dangerouslySetInnerHTML={{ __html: fieldStyles }} />
      <div className="cb-field">
        <label htmlFor={startId}>{startLabel}</label>
        <DatePicker
          id={startId}
          mode="month"
          value={start}
          onChange={onStartChange}
          placeholder="Select month"
          confirmLabel="Set start date"
          maxYear={maxYear}
          invalid={Boolean(startError)}
          describedBy={startError ? `${startId}-error` : undefined}
        />
        {startError ? (
          <p id={`${startId}-error`} className="cb-date-error" role="alert">
            {startError}
          </p>
        ) : null}
      </div>
      <div className="cb-field">
        <label htmlFor={endId}>{endLabel}</label>
        <DatePicker
          id={endId}
          mode="month"
          value={isCurrent ? '' : end}
          onChange={onEndChange}
          placeholder="Select month"
          confirmLabel="Set end date"
          disabled={isCurrent}
          maxYear={maxYear}
          invalid={Boolean(endError)}
          describedBy={endError ? `${endId}-error` : undefined}
        />
        {endError ? (
          <p id={`${endId}-error`} className="cb-date-error" role="alert">
            {endError}
          </p>
        ) : null}
      </div>
      {showPresent && (
        <label className="cb-present-row">
          <input type="checkbox" checked={isCurrent} onChange={(e) => onCurrentChange(e.target.checked)} />
          {presentLabel}
        </label>
      )}
    </div>
  );
}

export { formatMonthRange, formatEducationYearRange };
