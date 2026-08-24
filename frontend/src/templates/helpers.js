export function dateRange(start, end, current) {
  const parts = [];
  if (start) parts.push(start);
  if (current) parts.push("Present");
  else if (end) parts.push(end);
  return parts.join(" – ");
}

export function contactItems(data) {
  return [data.email, data.phone, data.location, data.linkedin, data.website].filter(Boolean);
}

export function contactLine(data, separator = "  •  ") {
  return contactItems(data).join(separator);
}

export const LEGACY_TEMPLATE_IDS = {
  "modern-sidebar": "ats-modern",
  "creative-bold": "ats-professional",
};

export function resolveTemplateId(id) {
  if (!id) return "ats-minimal";
  return LEGACY_TEMPLATE_IDS[id] || id;
}

export function nonEmptyList(list) {
  return Array.isArray(list) && list.length > 0;
}

export function visibleBullets(bullets) {
  return (bullets || []).filter((b) => String(b || "").trim());
}

export const EDUCATION_LEVELS = ["School", "College", "University", "Other"];

export function createEducationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `education-${crypto.randomUUID()}`;
  }
  return `education-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function blankEducation() {
  return {
    id: createEducationId(),
    level: "",
    institution: "",
    school: "",
    degree: "",
    fieldOfStudy: "",
    field: "",
    location: "",
    startDate: "",
    endDate: "",
    grade: "",
    gpa: "",
  };
}

export function normalizeEducationEntry(ed, index = 0) {
  const source = ed && typeof ed === "object" ? ed : {};
  const institution = source.institution || source.school || "";
  const fieldOfStudy = source.fieldOfStudy || source.field || "";
  const grade = source.grade || source.gpa || "";
  return {
    id: source.id || `education-${index + 1}-${institution || "entry"}`.replace(/\s+/g, "-").toLowerCase(),
    level: source.level || "",
    institution,
    school: institution,
    degree: source.degree || "",
    fieldOfStudy,
    field: fieldOfStudy,
    location: source.location || "",
    startDate: source.startDate || "",
    endDate: source.endDate || "",
    grade,
    gpa: grade,
  };
}

export function normalizeEducationList(list) {
  if (!Array.isArray(list)) return [];
  const used = new Set();
  return list.map((ed, index) => {
    const next = normalizeEducationEntry(ed, index);
    let id = next.id;
    if (used.has(id)) id = createEducationId();
    used.add(id);
    return { ...next, id };
  });
}

export function applyEducationPatch(entry, patch) {
  const next = { ...entry, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "institution")) next.school = patch.institution;
  if (Object.prototype.hasOwnProperty.call(patch, "school")) next.institution = patch.school;
  if (Object.prototype.hasOwnProperty.call(patch, "fieldOfStudy")) next.field = patch.fieldOfStudy;
  if (Object.prototype.hasOwnProperty.call(patch, "field")) next.fieldOfStudy = patch.field;
  if (Object.prototype.hasOwnProperty.call(patch, "grade")) next.gpa = patch.grade;
  if (Object.prototype.hasOwnProperty.call(patch, "gpa")) next.grade = patch.gpa;
  return next;
}

export function educationHeading(ed) {
  const qualification = [ed.degree, ed.fieldOfStudy || ed.field].filter(Boolean).join(" — ");
  return qualification || ed.level || ed.institution || ed.school || "Education";
}

export function educationPlaceLine(ed) {
  return [ed.institution || ed.school, ed.location].filter(Boolean).join(", ");
}

export function educationMetaLine(ed) {
  const dates = dateRange(ed.startDate, ed.endDate, false);
  const grade = ed.grade || ed.gpa;
  return [dates, grade].filter(Boolean).join(" | ");
}
