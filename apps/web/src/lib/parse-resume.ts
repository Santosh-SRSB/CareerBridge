import { EMPTY_DRAFT, type PassportDraft, type PassportProject } from "@/types/passport";

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asYear(value: unknown) {
  const raw = asString(value);
  const match = raw.match(/(20\d{2}|19\d{2})/);
  return match?.[1] || "";
}

function mapProjects(input: unknown): PassportProject[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((row) => {
      const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        title: asString(item.title) || asString(item.name) || asString(item.projectTitle),
        role: asString(item.role),
        year: asYear(item.year) || asYear(item.yearCompleted),
        description: asString(item.description),
        url: asString(item.url) || asString(item.link),
      };
    })
    .filter((row) => row.title || row.description)
    .slice(0, 12);
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

  const experience = Array.isArray(data.experience)
    ? data.experience
        .map((row) => {
          const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
          return {
            years: asString(item.years),
            company: asString(item.company),
            jobTitle: asString(item.jobTitle),
            stillInCompany: Boolean(item.stillInCompany),
            startDate: asString(item.startDate),
            endDate: asString(item.endDate),
            isInternship: Boolean(item.isInternship),
            description: asString(item.description),
          };
        })
        .filter((row) => row.company || row.jobTitle || row.description)
    : [];

  const projects = mapProjects(data.projects);

  return {
    firstName: asString(data.firstName),
    lastName: asString(data.lastName),
    city: asString(data.city),
    about: asString(data.about) || asString(data.summary),
    education: education.length ? education : EMPTY_DRAFT.education,
    stillInCollege: false,
    educationStart: "",
    educationEnd: "",
    experienceLevel: experience.length ? "experienced" : "fresher",
    totalExperienceYears: asString(data.totalExperienceYears),
    totalExperienceMonths: asString(data.totalExperienceMonths),
    experience: experience.length ? experience : EMPTY_DRAFT.experience,
    projects,
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
      `${label}\\s*[:\\-]?\\s*([\\s\\S]{8,1600}?)(?=\\n\\s*(education|skills|experience|work experience|career interest|interests|about|summary|projects|certification|achievements)s?\\b|$)`,
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

  const summaryBlock = section(text, ["summary", "profile", "about me", "professional summary"]);
  const experienceBlock = section(text, [
    "work experience",
    "professional experience",
    "employment",
    "experience",
    "internships",
  ]);
  const experience = parseExperienceBlock(experienceBlock);
  const projects = parseProjectsBlock(
    section(text, ["projects", "personal projects", "academic projects", "key projects"]),
  );

  return {
    firstName,
    lastName,
    city: "",
    about: summaryBlock.slice(0, 600),
    education,
    stillInCollege: false,
    educationStart: "",
    educationEnd: "",
    experienceLevel: experience.length ? "experienced" : "fresher",
    totalExperienceYears: "",
    totalExperienceMonths: "",
    experience: experience.length ? experience : EMPTY_DRAFT.experience,
    projects,
    gapReason: "",
    skills,
    careerInterests,
    source: "resume",
  };
}

function parseExperienceBlock(block: string) {
  if (!block.trim()) return [];
  const chunks = block.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return chunks.slice(0, 6).map((chunk) => {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    const header = lines[0] || "";
    const parts = header.split(/\s[-–|@]\s/);
    return {
      years: "",
      company: parts[1] || parts[0] || "",
      jobTitle: parts[0] || "",
      stillInCompany: /present|current/i.test(chunk),
      startDate: "",
      endDate: "",
      isInternship: /intern/i.test(chunk),
      description: lines.slice(1).join("\n") || header,
    };
  });
}

function parseProjectsBlock(block: string): PassportProject[] {
  if (!block.trim()) return [];
  const chunks = block.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const fromChunks = chunks.slice(0, 8).map((chunk) => {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    const header = lines[0]?.replace(/^[-•*]+\s*/, "") || "";
    const year = asYear(chunk);
    return {
      title: header.replace(/\s*[\(\[]?\d{4}[\)\]]?\s*$/, "").trim() || header,
      role: "",
      year,
      description: lines.slice(1).join(" ").trim(),
      url: (chunk.match(/https?:\/\/\S+/i)?.[0] || "").replace(/[),.;]+$/, ""),
    };
  });
  if (fromChunks.some((item) => item.title.length > 2)) {
    return fromChunks.filter((item) => item.title.length > 1);
  }
  // Fallback: bullet / single-line project lists
  return linesOf(block)
    .slice(0, 8)
    .map((line) => ({
      title: line.replace(/\s*[\(\[]?\d{4}[\)\]]?\s*$/, "").trim(),
      role: "",
      year: asYear(line),
      description: "",
      url: "",
    }))
    .filter((item) => item.title.length > 2);
}

export function extractReadableText(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const chunks = latin.match(/[A-Za-z0-9 ,.@+\-\n\r()]{5,}/g);
  return (chunks ?? []).join("\n");
}
