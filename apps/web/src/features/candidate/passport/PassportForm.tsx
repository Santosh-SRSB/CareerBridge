"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DRAFT_KEY,
  EMPTY_DRAFT,
  EMPTY_EXPERIENCE,
  type PassportDraft,
  type PassportExperience,
} from "@/types/passport";
import { SearchSelect } from "@/features/candidate/passport/SearchSelect";
import { DatePicker } from "@/features/candidate/passport/DatePicker";
import { COLLEGE_OPTIONS, DEGREE_OPTIONS, SKILL_OPTIONS } from "@/features/candidate/passport/field-options";
import { savePassport } from "@/lib/api";
import { careerGapMonths, declaredExperienceMonths, datedExperienceMonths, experienceMismatch, formatGapLabel } from "@/lib/career-gap";

function emptyClass(value: string) {
  return value.trim() ? "" : " is-empty";
}

function matchDegree(value: string) {
  const lower = value.toLowerCase();
  return (
    DEGREE_OPTIONS.find((item) => lower.includes(item.toLowerCase().replace(".", ""))) ||
    DEGREE_OPTIONS.find((item) => lower.includes(item.toLowerCase())) ||
    value
  );
}

export function PassportForm({ initial }: { initial: PassportDraft }) {
  const router = useRouter();
  const firstEdu = initial.education?.[0];
  const [firstName, setFirstName] = useState(initial.firstName || "");
  const [lastName, setLastName] = useState(initial.lastName || "");
  const [degree, setDegree] = useState(firstEdu?.qualification ? matchDegree(firstEdu.qualification) : "");
  const [college, setCollege] = useState(firstEdu?.institution || "");
  const [stillInCollege, setStillInCollege] = useState(Boolean(initial.stillInCollege));
  const [educationStart, setEducationStart] = useState(initial.educationStart || "");
  const [educationEnd, setEducationEnd] = useState(initial.educationEnd || firstEdu?.yearCompleted || "");
  const [skills, setSkills] = useState<string[]>(initial.skills || []);
  const [skillQuery, setSkillQuery] = useState("");
  const hasJob =
    initial.experienceLevel === "experienced" ||
    Boolean(initial.totalExperienceYears) ||
    Boolean(initial.totalExperienceMonths) ||
    Boolean(initial.experience.some((row) => row.company || row.jobTitle || row.startDate));
  const [experienceLevel, setExperienceLevel] = useState<"fresher" | "experienced">(
    initial.experienceLevel || (hasJob ? "experienced" : "fresher"),
  );
  const [totalYears, setTotalYears] = useState(initial.totalExperienceYears || "");
  const [totalMonths, setTotalMonths] = useState(initial.totalExperienceMonths || "");
  const [experience, setExperience] = useState<PassportExperience[]>(
    initial.experience?.some((row) => row.company || row.jobTitle)
      ? initial.experience.map((row) => ({ ...EMPTY_EXPERIENCE, ...row }))
      : [{ ...EMPTY_EXPERIENCE }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [gapReason, setGapReason] = useState(initial.gapReason || "");

  const gapMonths = useMemo(
    () =>
      careerGapMonths({
        stillInCollege,
        educationEnd,
        experience: experienceLevel === "fresher" ? [] : experience,
      }),
    [educationEnd, experience, experienceLevel, stillInCollege],
  );
  const gapLabel = gapMonths >= 1 ? formatGapLabel(gapMonths) : "";
  const datedMonths = useMemo(
    () => (experienceLevel === "experienced" ? datedExperienceMonths(experience) : 0),
    [experience, experienceLevel],
  );
  const declaredMonths = declaredExperienceMonths(totalYears, totalMonths);
  const durationMismatch = experienceLevel === "experienced" && experienceMismatch(declaredMonths, datedMonths);

  const missing = useMemo(() => {
    const gaps: string[] = [];
    if (!firstName) gaps.push("First name");
    if (!degree) gaps.push("Highest education");
    if (!skills.length) gaps.push("Skills");
    return gaps;
  }, [degree, firstName, skills.length]);

  const addSkill = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setSkills((prev) => (prev.some((item) => item.toLowerCase() === next.toLowerCase()) ? prev : [...prev, next]));
    setSkillQuery("");
  };

  const updateJob = (index: number, patch: Partial<PassportExperience>) => {
    setExperience((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const submit = async () => {
    if (durationMismatch) {
      setError("Experience not matching");
      return;
    }
    if (gapLabel && !gapReason.trim()) {
      setError("Please specify a correct and appropriate reason for your career gap.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await savePassport({
        firstName,
        lastName,
        stillInCollege,
        educationStart,
        educationEnd: stillInCollege ? "" : educationEnd,
        experienceLevel,
        totalExperienceYears: experienceLevel === "experienced" ? totalYears : "",
        totalExperienceMonths: experienceLevel === "experienced" ? totalMonths : "",
        skills,
        education: degree
          ? [
              {
                qualification: degree,
                institution: college,
                fieldOfStudy: "",
                yearCompleted: stillInCollege ? "" : educationEnd,
                startDate: educationStart || undefined,
                endDate: stillInCollege ? undefined : educationEnd || undefined,
              },
            ]
          : [],
        experience:
          experienceLevel === "experienced"
            ? experience.map((row) => ({
                company: row.company,
                jobTitle: row.jobTitle,
                startDate: row.startDate || undefined,
                endDate: row.endDate || undefined,
                stillInCompany: row.stillInCompany,
                isInternship: row.isInternship,
              }))
            : [],
        gapReason: gapLabel ? gapReason : "",
        source: initial.source,
      });
      sessionStorage.removeItem(DRAFT_KEY);
      setSaved(true);
      window.setTimeout(() => router.push("/passport?overview=1"), 400);
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

      <div className="passport-field">
        Name
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            required
            className={emptyClass(firstName)}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="First name"
          />
          <input
            className={emptyClass(lastName)}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            placeholder="Last name"
          />
        </div>
      </div>

      <div className="passport-field">
        Highest education
        <select
          className={emptyClass(degree)}
          value={degree}
          onChange={(event) => setDegree(event.target.value)}
        >
          <option value="">Select degree</option>
          {DEGREE_OPTIONS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <SearchSelect
          label="College"
          value={college}
          options={COLLEGE_OPTIONS}
          placeholder="Search or type college name"
          emptyClass={emptyClass(college)}
          freeText
          onChange={setCollege}
        />
        <div className={`passport-date-row${stillInCollege ? " is-current" : ""}`}>
          <label className="passport-field">
            Start date
            <DatePicker
              value={educationStart}
              emptyClass={emptyClass(educationStart)}
              onChange={setEducationStart}
            />
          </label>
          <label className="passport-current-check">
            <input
              type="checkbox"
              checked={stillInCollege}
              onChange={(event) => {
                const checked = event.target.checked;
                setStillInCollege(checked);
                if (checked) setEducationEnd("");
              }}
            />
            Still in college
          </label>
          {stillInCollege ? null : (
            <label className="passport-field">
              End date
              <DatePicker
                value={educationEnd}
                emptyClass={emptyClass(educationEnd)}
                onChange={setEducationEnd}
              />
            </label>
          )}
        </div>
      </div>

      <div className="passport-field">
        Skills
        <SearchSelect
          label=""
          value={skillQuery}
          options={SKILL_OPTIONS.filter((item) => !skills.includes(item))}
          placeholder="Search IT or non-IT skills"
          onChange={addSkill}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {skills.map((item) => (
            <button
              key={item}
              type="button"
              className="rounded-full bg-navy px-3 py-1 text-sm font-semibold text-white"
              onClick={() => setSkills((prev) => prev.filter((skill) => skill !== item))}
            >
              {item} ×
            </button>
          ))}
        </div>
      </div>

      <div className="passport-field">
        Experience
        <div className="exp-level-toggle" role="tablist" aria-label="Experience level">
          <button
            type="button"
            className={experienceLevel === "fresher" ? "is-on" : ""}
            onClick={() => setExperienceLevel("fresher")}
          >
            Fresher
          </button>
          <button
            type="button"
            className={experienceLevel === "experienced" ? "is-on" : ""}
            onClick={() => setExperienceLevel("experienced")}
          >
            Experienced
          </button>
        </div>

        {experienceLevel === "experienced" ? (
          <>
            <div className="exp-duration-row">
              <label className="passport-field">
                Years
                <select
                  className={emptyClass(totalYears === "0" ? "" : totalYears)}
                  value={totalYears}
                  onChange={(event) => setTotalYears(event.target.value)}
                >
                  <option value="">Years</option>
                  {Array.from({ length: 41 }, (_, index) => (
                    <option key={index} value={String(index)}>
                      {index === 1 ? "1 year" : `${index} years`}
                    </option>
                  ))}
                </select>
              </label>
              <label className="passport-field">
                Months
                <select
                  className={emptyClass(totalMonths === "0" ? "" : totalMonths)}
                  value={totalMonths}
                  onChange={(event) => setTotalMonths(event.target.value)}
                >
                  <option value="">Months</option>
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index} value={String(index)}>
                      {index === 1 ? "1 month" : `${index} months`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {durationMismatch ? (
              <p className="experience-mismatch" role="alert">
                Experience not matching
              </p>
            ) : null}
            {experience.map((row, index) => (
          <div key={index} className="passport-job-card mb-4 rounded-2xl border border-navy/10 p-4">
            <p className="mb-3 text-sm font-bold text-navy">
              {row.isInternship ? "Internship" : "Company"} {index + 1}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="passport-field">
                Role
                <input
                  className={emptyClass(row.jobTitle)}
                  value={row.jobTitle}
                  onChange={(event) => updateJob(index, { jobTitle: event.target.value })}
                  placeholder="Software engineer"
                />
              </label>
              <label className="passport-field">
                Company name
                <input
                  className={emptyClass(row.company)}
                  value={row.company}
                  onChange={(event) => updateJob(index, { company: event.target.value })}
                  placeholder="Company"
                />
              </label>
            </div>
            <div className={`passport-date-row mt-3${row.stillInCompany ? " is-current" : ""}`}>
              <label className="passport-field">
                From
                <DatePicker
                  value={row.startDate}
                  emptyClass={emptyClass(row.startDate)}
                  onChange={(next) => updateJob(index, { startDate: next })}
                />
              </label>
              <label className="passport-current-check">
                <input
                  type="checkbox"
                  checked={row.stillInCompany}
                  onChange={(event) =>
                    updateJob(index, {
                      stillInCompany: event.target.checked,
                      endDate: event.target.checked ? "" : row.endDate,
                    })
                  }
                />
                Still in the company
              </label>
              {row.stillInCompany ? null : (
                <label className="passport-field">
                  To
                  <DatePicker
                    value={row.endDate}
                    emptyClass={emptyClass(row.endDate)}
                    onChange={(next) => updateJob(index, { endDate: next })}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="text-sm font-bold text-navy"
            onClick={() => setExperience((prev) => [...prev, { ...EMPTY_EXPERIENCE }])}
          >
            + Add other company
          </button>
          <button
            type="button"
            className="text-sm font-bold text-navy"
            onClick={() => setExperience((prev) => [...prev, { ...EMPTY_EXPERIENCE, isInternship: true }])}
          >
            + Add internship
          </button>
        </div>
          </>
        ) : (
          <p className="text-sm font-medium text-muted">
            As a fresher, any time after your college end date is counted as a gap.
          </p>
        )}
      </div>

      {gapLabel ? (
        <div className="career-gap-box">
          <p className="career-gap-title">You have a gap of {gapLabel}.</p>
          <p>Please specify your reason.</p>
          <p className="career-gap-help">We are taking this to help you build a better career.</p>
          <label className="passport-field">
            Reason
            <textarea
              required
              rows={3}
              className={emptyClass(gapReason)}
              value={gapReason}
              onChange={(event) => setGapReason(event.target.value)}
              placeholder="Reason should be correct and appropriate"
            />
          </label>
        </div>
      ) : null}

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
