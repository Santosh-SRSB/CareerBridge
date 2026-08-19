import type { PassportDraft } from "@/types/passport";

function section(text: string, labels: string[]) {
  const lower = text.replace(/\r/g, "");
  for (const label of labels) {
    const re = new RegExp(
      `${label}\\s*[:\\-]?\\s*([\\s\\S]{8,900}?)(?=\\n\\s*(education|skills|experience|about|summary|projects|certification)s?\\b|$)`,
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

  const cityMatch =
    text.match(/\b(Chennai|Madurai|Coimbatore|Bengaluru|Bangalore|Hyderabad|Pune|Mumbai|Delhi|Kolkata|Jaipur)\b/i) ??
    text.match(/city\s*[:\-]\s*([A-Za-z ]{2,30})/i);

  const about =
    section(text, ["about", "summary", "objective", "profile"]) ||
    firstLines.slice(1, 4).join(" ");

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

  return {
    firstName,
    lastName,
    city: cityMatch?.[1] ?? cityMatch?.[0] ?? "",
    about,
    education,
    skills,
    source: "resume",
  };
}

export function extractReadableText(buffer: Buffer) {
  const latin = buffer.toString("latin1");
  const chunks = latin.match(/[A-Za-z0-9 ,.@+\-\n\r()]{5,}/g);
  return (chunks ?? []).join("\n");
}
