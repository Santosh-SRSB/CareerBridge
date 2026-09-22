'use client';

import { useMemo } from 'react';
import { orderedIndianCitiesForJobForm } from '@careerbridge/shared';
import { SearchableCreatableSelect } from '@/components/ui/SearchableCreatableSelect';

export function CitySelect({
  label = 'Location',
  value,
  onChange,
  allowAll = false,
  required = false,
  id = 'city',
}: {
  label?: string;
  value: string;
  onChange: (city: string) => void;
  allowAll?: boolean;
  required?: boolean;
  id?: string;
}) {
  const ordered = useMemo(() => orderedIndianCitiesForJobForm(), []);
  const options = allowAll ? ['All cities', ...ordered] : ordered;

  return (
    <SearchableCreatableSelect
      id={id}
      label={label}
      value={value === '' && allowAll ? 'All cities' : value}
      onChange={(next) => onChange(next === 'All cities' ? '' : next)}
      options={options}
      placeholder="Search city or type your own…"
      allowCustom={!allowAll}
      required={required && !allowAll}
      emptyLimit={40}
    />
  );
}
