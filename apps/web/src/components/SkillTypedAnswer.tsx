'use client';

import { FormEvent } from 'react';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { SkillMascot } from '@/components/SkillMascot';

export function SkillTypedAnswer({
  value,
  onChange,
  error,
  loading,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  error: string;
  loading: boolean;
  onSubmit: (text: string) => void;
}) {
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(value.trim());
  }

  const words = value.trim().split(/\s+/).filter(Boolean).length;
  const fill = Math.min(100, Math.round((words / 40) * 100));

  return (
    <form onSubmit={submit} className="cb-type-desk">
      <div className="cb-type-head">
        <SkillMascot pose="idea" className="cb-type-bulb" alt="" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">Own words only</p>
          <p className="text-[11px] text-muted">Do not paste from ChatGPT. Write what you actually know.</p>
        </div>
        <strong className="shrink-0 text-sm font-extrabold text-primary">{words}</strong>
      </div>
      <div className="cb-check-meter">
        <i style={{ width: `${fill}%` }} />
      </div>
      <Textarea
        label={`Your answer · ${words} words`}
        name="typedAnswer"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write a short answer in your own words."
        className="cb-type-field"
        error={error || undefined}
      />
      <Button type="submit" size="md" block={false} className="cb-studio-btn" loading={loading} loadingLabel="Saving...">
        Submit
      </Button>
    </form>
  );
}
