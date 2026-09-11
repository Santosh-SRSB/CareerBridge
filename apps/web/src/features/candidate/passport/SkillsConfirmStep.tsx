'use client';

import { useState } from 'react';

type SkillsConfirmStepProps = {
  skills: string[];
  onConfirm: (skills: string[]) => void;
  onBack?: () => void;
};

/**
 * Build Your Profile — confirm/edit extracted skills before continuing.
 * Additive step; does not alter PassportForm itself.
 */
export function SkillsConfirmStep({ skills, onConfirm, onBack }: SkillsConfirmStepProps) {
  const [list, setList] = useState<string[]>(() =>
    skills.map((s) => String(s || '').trim()).filter(Boolean),
  );
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  function addSkill() {
    const value = draft.trim();
    if (!value) return;
    if (list.some((s) => s.toLowerCase() === value.toLowerCase())) {
      setDraft('');
      return;
    }
    setList((prev) => [...prev, value]);
    setDraft('');
  }

  function removeSkill(index: number) {
    setList((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-deep">Build your profile</p>
      <h1 className="font-display mt-3 text-3xl font-extrabold text-navy">Confirm your skills</h1>
      <p className="mt-3 max-w-xl text-sm text-muted">
        We pulled these skills from your resume. Keep them as-is, or edit before continuing.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {list.length === 0 ? (
            <p className="text-sm text-slate-500">No skills extracted yet — add a few below.</p>
          ) : (
            list.map((skill, index) => (
              <span
                key={`${skill}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-900"
              >
                {skill}
                {editing ? (
                  <button
                    type="button"
                    aria-label={`Remove ${skill}`}
                    className="ml-0.5 text-teal-700 hover:text-red-600"
                    onClick={() => removeSkill(index)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            ))
          )}
        </div>

        {editing ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add a skill"
            />
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700"
              onClick={addSkill}
            >
              Add
            </button>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {!editing ? (
            <>
              <button
                type="button"
                className="rounded-xl bg-[#0a2e2c] px-4 py-3 text-sm font-bold text-white hover:bg-[#072422]"
                onClick={() => onConfirm(list)}
              >
                Keep these
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                onClick={() => setEditing(true)}
              >
                Edit skills
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-xl bg-[#0a2e2c] px-4 py-3 text-sm font-bold text-white hover:bg-[#072422]"
              onClick={() => onConfirm(list)}
            >
              Save skills &amp; continue
            </button>
          )}
          {onBack ? (
            <button
              type="button"
              className="rounded-xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-500"
              onClick={onBack}
            >
              Back
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
