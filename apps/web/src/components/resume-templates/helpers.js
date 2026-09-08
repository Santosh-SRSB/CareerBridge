export function dateRange(start, end, current) {
  const parts = [];
  if (start) parts.push(start);
  if (current) parts.push("Present");
  else if (end) parts.push(end);
  return parts.join(" – ");
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const CAREER_GAP_TYPES = [
  "Career Development Period",
  "Education / Coursework",
  "Family / Personal",
  "Health",
  "Relocation",
  "Job search",
  "Freelance / Independent work",
  "Other",
];

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
  if (!id || id === "master" || id === "CAREERBRIDGE") return "resume-template-01";
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

function makeLocalId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createProjectId() {
  return makeLocalId("project");
}

export function createProjectBulletId() {
  return makeLocalId("project-bullet");
}

export function blankProject() {
  return {
    id: createProjectId(),
    name: "",
    title: "",
    description: "",
    link: "",
    url: "",
    technologies: [],
    bullets: [{ id: createProjectBulletId(), text: "" }],
    bulletPoints: [],
    startDate: "",
    endDate: "",
  };
}

export function normalizeHttpUrl(raw, errorMessage = "Please enter a valid URL.") {
  const value = String(raw || "").trim();
  if (!value) return { ok: true, href: "", display: "" };
  if (/^(javascript|data|vbscript):/i.test(value)) {
    return { ok: false, href: value, display: value, error: errorMessage };
  }
  let candidate = value;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/\//, "")}`;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    return { ok: false, href: value, display: value, error: errorMessage };
  }
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || !/[a-z0-9-]+\.[a-z]{2,}$/i.test(parsed.hostname)) {
      return { ok: false, href: value, display: value, error: errorMessage };
    }
    const display = `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`.replace(/\/$/, "");
    return { ok: true, href: parsed.toString(), display };
  } catch {
    return { ok: false, href: value, display: value, error: errorMessage };
  }
}

export function normalizeProjectUrl(raw) {
  return normalizeHttpUrl(raw, "Please enter a valid project URL.");
}

export function normalizeCertificateUrl(raw) {
  return normalizeHttpUrl(raw, "Please enter a valid certificate URL.");
}

function asBulletEntry(raw, index = 0) {
  if (raw && typeof raw === "object") {
    return {
      id: raw.id || createProjectBulletId(),
      text: String(raw.text || raw.value || "").trim() ? String(raw.text || raw.value || "") : "",
    };
  }
  return {
    id: `project-bullet-${index + 1}-${String(raw || "item").slice(0, 12)}`.replace(/\s+/g, "-").toLowerCase(),
    text: String(raw || ""),
  };
}

export function projectBulletEntries(project) {
  const source = project && typeof project === "object" ? project : {};
  const list = Array.isArray(source.bullets)
    ? source.bullets
    : Array.isArray(source.bulletPoints)
      ? source.bulletPoints
      : [];
  return list.map((item, index) => asBulletEntry(item, index));
}

export function projectBulletTexts(project) {
  return projectBulletEntries(project).map((b) => String(b.text || "").trim()).filter(Boolean);
}

export function projectTechnologies(project) {
  const source = project && typeof project === "object" ? project : {};
  const fromValue = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item && typeof item === "object") return String(item.name || item.text || item.value || "").trim();
        return String(item || "").trim();
      }).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value.split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [];
  };
  const listed = fromValue(source.technologies);
  if (listed.length) return listed;
  return fromValue(source.technology || source.tech);
}

export function normalizeProjectEntry(project, index = 0) {
  const source = project && typeof project === "object" ? project : {};
  const name = source.name || source.title || "";
  const url = source.url || source.link || "";
  const bullets = projectBulletEntries(source);
  const used = new Set();
  const uniqueBullets = bullets.map((b, i) => {
    let id = b.id || createProjectBulletId();
    if (used.has(id)) id = createProjectBulletId();
    used.add(id);
    return { id, text: b.text || "" };
  });
  return {
    id: source.id || `project-${index + 1}-${name || "entry"}`.replace(/\s+/g, "-").toLowerCase(),
    name,
    title: name,
    description: source.description || "",
    link: url,
    url,
    technologies: projectTechnologies(source),
    bullets: uniqueBullets,
    bulletPoints: uniqueBullets.map((b) => b.text),
    startDate: source.startDate || "",
    endDate: source.endDate || "",
  };
}

export function normalizeProjectList(list) {
  if (!Array.isArray(list)) return [];
  const used = new Set();
  return list.map((project, index) => {
    const next = normalizeProjectEntry(project, index);
    let id = next.id;
    if (used.has(id)) id = createProjectId();
    used.add(id);
    return { ...next, id };
  });
}

export function applyProjectPatch(entry, patch) {
  const next = { ...entry, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "name")) next.title = patch.name;
  if (Object.prototype.hasOwnProperty.call(patch, "title")) next.name = patch.title;
  if (Object.prototype.hasOwnProperty.call(patch, "url")) next.link = patch.url;
  if (Object.prototype.hasOwnProperty.call(patch, "link")) next.url = patch.link;
  if (Object.prototype.hasOwnProperty.call(patch, "bullets")) {
    next.bulletPoints = projectBulletEntries({ bullets: patch.bullets }).map((b) => b.text);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "technologies")) {
    if (Array.isArray(patch.technologies)) {
      next.technologies = patch.technologies.map((item) => {
        if (item && typeof item === "object") return String(item.name || item.text || item.value || "");
        return String(item ?? "");
      });
    } else if (typeof patch.technologies === "string") {
      next.technologies = patch.technologies.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  return next;
}

export function createCertificationId() {
  return makeLocalId("certification");
}

export function blankCertification() {
  return {
    id: createCertificationId(),
    name: "",
    issuer: "",
    date: "",
    url: "",
  };
}

export function normalizeCertificationEntry(cert, index = 0) {
  const source = cert && typeof cert === "object" ? cert : {};
  return {
    id: source.id || `certification-${index + 1}-${source.name || "entry"}`.replace(/\s+/g, "-").toLowerCase(),
    name: source.name || "",
    issuer: source.issuer || "",
    date: source.date || "",
    url: source.url || source.link || "",
  };
}

export function normalizeCertificationList(list) {
  if (!Array.isArray(list)) return [];
  const used = new Set();
  return list.map((cert, index) => {
    const next = normalizeCertificationEntry(cert, index);
    let id = next.id;
    if (used.has(id)) id = createCertificationId();
    used.add(id);
    return { ...next, id };
  });
}

export function createCareerGapId() {
  return makeLocalId("career-gap");
}

function formatGapMonthYear(month, year, fallback, current) {
  if (current) return "Present";
  const monthText = String(month || "").trim();
  const yearText = String(year || "").trim();
  if (monthText && yearText) return `${monthText} ${yearText}`;
  return String(fallback || "").trim();
}

function stringList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object") return String(item.name || item.text || item.value || "").trim();
      return String(item || "").trim();
    }).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function blankCareerGap() {
  return {
    id: createCareerGapId(),
    type: "",
    reason: "",
    startMonth: "",
    startYear: "",
    endMonth: "",
    endYear: "",
    current: false,
    description: "",
    activities: [""],
    skills: [""],
    certifications: [""],
    projects: [""],
    startDate: "",
    endDate: "",
  };
}

export function normalizeCareerGapEntry(gap, index = 0) {
  const source = gap && typeof gap === "object" ? gap : {};
  const startDate = formatGapMonthYear(source.startMonth, source.startYear, source.startDate, false);
  const endDate = source.current
    ? "Present"
    : formatGapMonthYear(source.endMonth, source.endYear, source.endDate, false);
  const type = source.type || source.reason || source.title || "";
  return {
    id: source.id || `career-gap-${index + 1}-${type || "entry"}`.replace(/\s+/g, "-").toLowerCase(),
    type,
    reason: source.reason || type,
    startMonth: source.startMonth || "",
    startYear: source.startYear || "",
    endMonth: source.endMonth || "",
    endYear: source.endYear || "",
    current: Boolean(source.current),
    description: source.description || "",
    activities: Array.isArray(source.activities) ? source.activities.map((item) => String(item ?? "")) : stringList(source.activities),
    skills: Array.isArray(source.skills) ? source.skills.map((item) => String(item ?? "")) : stringList(source.skills),
    certifications: Array.isArray(source.certifications) ? source.certifications.map((item) => String(item ?? "")) : stringList(source.certifications),
    projects: Array.isArray(source.projects) ? source.projects.map((item) => String(item ?? "")) : stringList(source.projects),
    startDate,
    endDate,
  };
}

export function normalizeCareerGapList(list) {
  const source = Array.isArray(list) ? list : [];
  const used = new Set();
  return source.map((gap, index) => {
    const next = normalizeCareerGapEntry(gap, index);
    let id = next.id;
    if (used.has(id)) id = createCareerGapId();
    used.add(id);
    return { ...next, id };
  });
}

export function applyCareerGapPatch(entry, patch) {
  const next = { ...entry, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, "type") && !patch.reason) next.reason = patch.type;
  if (Object.prototype.hasOwnProperty.call(patch, "reason") && !patch.type) next.type = patch.reason;
  next.startDate = formatGapMonthYear(next.startMonth, next.startYear, next.startDate, false);
  next.endDate = next.current
    ? "Present"
    : formatGapMonthYear(next.endMonth, next.endYear, next.endDate, false);
  return next;
}

export function careerGapDateRange(gap) {
  const start = formatGapMonthYear(gap.startMonth, gap.startYear, gap.startDate, false);
  const end = gap.current ? "Present" : formatGapMonthYear(gap.endMonth, gap.endYear, gap.endDate, false);
  return dateRange(start, end, false);
}

export function visibleCareerGapItems(gap) {
  const list = (value) => (Array.isArray(value) ? value : []).map((item) => String(item || "").trim()).filter(Boolean);
  return {
    activities: list(gap.activities),
    skills: list(gap.skills),
    certifications: list(gap.certifications),
    projects: list(gap.projects),
  };
}
