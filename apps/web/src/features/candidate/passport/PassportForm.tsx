"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DRAFT_KEY, EMPTY_DRAFT, type PassportDraft } from "@/types/passport";

export function PassportForm({ initial }: { initial: PassportDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<PassportDraft>(initial);
  const [skillInput, setSkillInput] = useState(initial.skills.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (!draft.firstName) gaps.push("Name");
    if (!draft.city) gaps.push("City");
    if (!draft.about) gaps.push("About");
    if (!draft.education.some((row) => row.qualification)) gaps.push("Education");
    if (!draft.skills.length && !skillInput.trim()) gaps.push("Skills");
    return gaps;
  }, [draft, skillInput]);

  const updateEdu = (
    index: number,
    key: keyof PassportDraft["education"][number],
    value: string,
  ) => {
    setDraft((prev) => {
      const education = [...prev.education];
      education[index] = { ...education[index], [key]: value };
      return { ...prev, education };
    });
  };

  const submit = async () => {
    setSaving(true);
    setError("");
    const skills = skillInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const payload: PassportDraft = { ...draft, skills };
    try {
      const response = await fetch("/api/v1/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error?.message ?? "Save failed");
      }
      sessionStorage.removeItem(DRAFT_KEY);
      setSaved(true);
      window.setTimeout(() => router.push("/"), 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="passport-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {missing.length ? (
        <p className="rounded-2xl border border-orange/30 bg-orange/10 px-4 py-3 text-sm text-navy">
          Fill anything we could not fetch: {missing.join(", ")}.
        </p>
      ) : null}

      <label className="passport-field">
        Full name
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            value={draft.firstName}
            onChange={(event) => setDraft({ ...draft, firstName: event.target.value })}
            placeholder="First name"
          />
          <input
            value={draft.lastName}
            onChange={(event) => setDraft({ ...draft, lastName: event.target.value })}
            placeholder="Last name"
          />
        </div>
      </label>

      <label className="passport-field">
        Current city
        <input
          value={draft.city}
          onChange={(event) => setDraft({ ...draft, city: event.target.value })}
          placeholder="Chennai"
        />
      </label>

      <label className="passport-field">
        About
        <textarea
          rows={4}
          value={draft.about}
          onChange={(event) => setDraft({ ...draft, about: event.target.value })}
          placeholder="A short professional summary"
        />
      </label>

      <div className="passport-field">
        Education
        {draft.education.map((row, index) => (
          <div key={index} className="mb-3 grid gap-3 sm:grid-cols-2">
            <input
              value={row.qualification}
              onChange={(event) => updateEdu(index, "qualification", event.target.value)}
              placeholder="Qualification"
            />
            <input
              value={row.institution}
              onChange={(event) => updateEdu(index, "institution", event.target.value)}
              placeholder="Institution"
            />
            <input
              value={row.fieldOfStudy}
              onChange={(event) => updateEdu(index, "fieldOfStudy", event.target.value)}
              placeholder="Field of study"
            />
            <input
              value={row.yearCompleted}
              onChange={(event) => updateEdu(index, "yearCompleted", event.target.value)}
              placeholder="Year"
            />
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-bold text-navy"
          onClick={() =>
            setDraft({
              ...draft,
              education: [
                ...draft.education,
                { qualification: "", institution: "", fieldOfStudy: "", yearCompleted: "" },
              ],
            })
          }
        >
          + Add education
        </button>
      </div>

      <label className="passport-field">
        Skills
        <input
          value={skillInput}
          onChange={(event) => setSkillInput(event.target.value)}
          placeholder="Communication, MS Excel, Sales"
        />
      </label>

      {error ? <p className="text-sm font-semibold text-orange">{error}</p> : null}
      {saved ? (
        <p className="rounded-2xl bg-teal/15 px-4 py-3 text-sm font-semibold text-navy">
          Career Passport saved. Your profile is ready.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="cta-shine inline-flex items-center justify-center rounded-full px-7 py-3.5 text-sm font-bold text-white"
      >
        {saving ? "Saving..." : "Save Career Passport"}
      </button>
    </form>
  );
}

export { EMPTY_DRAFT };
