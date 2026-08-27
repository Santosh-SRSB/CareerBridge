import React from 'react';

export default function SkillChip({ children, tone = 'default' }) {
  return <span className={`skill-chip skill-chip-${tone}`}>{children}</span>;
}
