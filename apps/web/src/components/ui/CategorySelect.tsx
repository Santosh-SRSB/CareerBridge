'use client';

import { useMemo } from 'react';
import { DEFAULT_JOB_CATEGORY_ITEMS } from '@careerbridge/shared';
import { GroupedSelect } from '@/components/ui/GroupedSelect';
import { useCatalog } from '@/hooks/useCatalog';

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
  const { items } = useCatalog('job-categories', DEFAULT_JOB_CATEGORY_ITEMS);
  const groups = useMemo(() => {
    const tech = items.filter((item) => item.parentValue === 'TECH').map((item) => item.label);
    const nonTech = items.filter((item) => item.parentValue !== 'TECH').map((item) => item.label);
    return [
      { label: 'Tech', options: tech },
      { label: 'Non-tech', options: nonTech },
    ].filter((group) => group.options.length > 0);
  }, [items]);

  return (
    <GroupedSelect
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      groups={groups}
      allowAll={allowAll}
      allLabel="All categories"
      placeholder="Select category"
      required={required}
      otherInputLabel="Enter category"
      otherPlaceholder="Type a category"
    />
  );
}
