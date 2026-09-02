'use client';

import { NON_TECH_JOB_CATEGORIES, TECH_JOB_CATEGORIES } from '@careerbridge/shared';
import { GroupedSelect } from '@/components/ui/GroupedSelect';

export function CategorySelect({
  label = 'Category',
  value,
  onChange,
  allowAll = false,
  required = false,
  id = 'category',
}: {
  label?: string;
  value: string;
  onChange: (category: string) => void;
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
      groups={[
        { label: 'Tech', options: TECH_JOB_CATEGORIES },
        { label: 'Non-tech', options: NON_TECH_JOB_CATEGORIES },
      ]}
      allowAll={allowAll}
      allLabel="All categories"
      placeholder="Select category"
      required={required}
      otherInputLabel="Enter category"
      otherPlaceholder="Type a category"
    />
  );
}
