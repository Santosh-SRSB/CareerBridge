'use client';

import { useMemo } from 'react';
import { GroupedSelect } from '@/components/ui/GroupedSelect';
import { INDIA_STATES, getCitiesForState } from '@/data/india-locations';

const selectClassName =
  'w-full rounded-xl border border-primary/15 bg-[#f8faf9] px-3.5 py-2.5 text-sm font-medium text-primary outline-none transition hover:border-primary/30 focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/20';

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
  const cities = useMemo(() => getCitiesForState(state), [state]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block" htmlFor="job-state">
        <span className="mb-1.5 block text-sm font-bold text-slate-800">
          State <span className="text-red-500">*</span>
        </span>
        <select
          id="job-state"
          required
          value={state}
          onChange={(event) => {
            onStateChange(event.target.value);
            onCityChange('');
          }}
          className={selectClassName}
        >
          <option value="">Select state</option>
          {INDIA_STATES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <div className={!state ? 'pointer-events-none opacity-60' : undefined}>
        <GroupedSelect
          id="job-city"
          label="City (optional)"
          value={city}
          onChange={onCityChange}
          groups={[{ options: cities }]}
          allowAll
          allLabel="All cities in state"
          placeholder={state ? 'Select city' : 'Select state first'}
          otherInputLabel="Enter city manually"
          otherPlaceholder="Type your city"
        />
      </div>
    </div>
  );
}
