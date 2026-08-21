import { EMPTY_DRAFT, type PassportDraft } from "@/types/passport";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function toPassportDraft(input: unknown, source: PassportDraft["source"] = "resume"): PassportDraft {
  const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const education = Array.isArray(data.education)
    ? data.education
        .map((row) => {
          const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
          return {
            qualification: asString(item.qualification),
            institution: asString(item.institution),
            fieldOfStudy: asString(item.fieldOfStudy),
            yearCompleted: asString(item.yearCompleted),
          };
        })
        .filter((row) => row.qualification || row.institution)
    : [];
  const skills = Array.isArray(data.skills)
    ? data.skills.map((item) => asString(item)).filter(Boolean).slice(0, 20)
    : [];
  const careerInterests = Array.isArray(data.careerInterests)
    ? data.careerInterests.map((item) => asString(item)).filter(Boolean).slice(0, 8)
    : [];

  return {
    firstName: asString(data.firstName),
    lastName: asString(data.lastName),
    city: "",
    about: "",
    education: education.length ? education : EMPTY_DRAFT.education,
    stillInCollege: false,
    educationStart: "",
    educationEnd: "",
    experienceLevel: "fresher",
    totalExperienceYears: asString(data.totalExperienceYears),
    totalExperienceMonths: asString(data.totalExperienceMonths),
    experience: EMPTY_DRAFT.experience,
    gapReason: asString(data.gapReason),
    skills,
    careerInterests,
    source,
  };
}

function section(text: string, labels: string[]) {
  const lower = text.replace(/\r/g, "");
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*([\\s\\S]{8,900}?)(?=\\n\\s*(education|skills|experience|work experience|career interest|interests|about|summary|projects|certification)s?\\b|$)`,
      "i",
    );
    const match = lower.match(re);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function linesOf(block: string) {
  return block
    .split(/\n|,|;|\|/)
    .map((item) => item.replace(/^[-•*]+\s*/, "").trim())
    .filter((item) => item.length > 1 && item.length < 80);
}

export function parseResumeText(raw: string): PassportDraft {
  const text = raw.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ");
  const firstLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const nameLine =
    firstLines.find((line) => /^[A-Za-z][A-Za-z .']{2,40}$/.test(line)) ?? "";
  const [firstName = "", ...rest] = nameLine.split(" ");
  const lastName = rest.join(" ");

  const educationBlock = section(text, ["education", "qualification", "academics"]);
  const educationLines = linesOf(educationBlock).slice(0, 3);
  const education =
    educationLines.length > 0
      ? educationLines.map((line) => ({
          qualification: line,
          institution: "",
          fieldOfStudy: "",
          yearCompleted: (line.match(/(20\d{2}|19\d{2})/) ?? [""])[0],
        }))
      : [
          {
            qualification: "",
            institution: "",
            fieldOfStudy: "",
            yearCompleted: "",
          },
        ];

  const skillBlock = section(text, ["skills", "skill set", "technical skills"]);
  const skills = linesOf(skillBlock).slice(0, 12);

  const interestBlock = section(text, ["career interest", "interests", "areas of interest", "objective"]);
  const careerInterests = linesOf(interestBlock).slice(0, 6);

  return {
    firstName,
    lastName,
    city: "",
    about: "",
    education,
    stillInCollege: false,
    educationStart: "",
    educationEnd: "",
    experienceLevel: "fresher",
    totalExperienceYears: "",
    totalExperienceMonths: "",
    experience: EMPTY_DRAFT.experience,
    gapReason: "",
    skills,
    careerInterests,
    source: "resume",
  };
}

export function extractReadableText(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const chunks = latin.match(/[A-Za-z0-9 ,.@+\-\n\r()]{5,}/g);
  return (chunks ?? []).join("\n");
}
