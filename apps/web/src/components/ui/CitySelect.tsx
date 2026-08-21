'use client';

import { INDIAN_CITIES } from '@careerbridge/shared';
import { GroupedSelect } from '@/components/ui/GroupedSelect';

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
  return (
    <GroupedSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      groups={[{ options: INDIAN_CITIES }]}
      allowAll={allowAll}
      allLabel="All cities"
      placeholder="Select city"
      required={required}
      otherInputLabel="Enter city"
      otherPlaceholder="Type your city"
    />
  );
}
