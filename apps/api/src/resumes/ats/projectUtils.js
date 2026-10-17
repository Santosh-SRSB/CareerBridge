function text(value) {
  return String(value == null ? "" : value).trim();
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function projectBulletEntries(project) {
  const source = project && typeof project === "object" ? project : {};
  const list = Array.isArray(source.bullets)
    ? source.bullets
    : Array.isArray(source.bulletPoints)
      ? source.bulletPoints
      : [];
  return list.map((item, index) => {
    if (item && typeof item === "object") {
      return { id: item.id || createId("project-bullet"), text: String(item.text || item.value || "") };
    }
    return { id: `project-bullet-${index + 1}`, text: String(item || "") };
  });
}

function projectBulletTexts(project) {
  return projectBulletEntries(project).map((b) => text(b.text)).filter(Boolean);
}

function projectTechnologies(project) {
  const source = project && typeof project === "object" ? project : {};
  const fromValue = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => {
        if (item && typeof item === "object") return text(item.name || item.text || item.value);
        return text(item);
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

function projectUrl(project) {
  const source = project && typeof project === "object" ? project : {};
  return text(source.url || source.link);
}

function projectName(project) {
  const source = project && typeof project === "object" ? project : {};
  return text(source.name || source.title);
}

function normalizeProjectUrl(raw) {
  const value = text(raw);
  if (!value) return { ok: true, href: "", display: "" };
  if (/^(javascript|data|vbscript):/i.test(value)) {
    return { ok: false, href: value, display: value, error: "Please enter a valid project URL." };
  }
  let candidate = value;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/\//, "")}`;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    return { ok: false, href: value, display: value, error: "Please enter a valid project URL." };
  }
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname || !/[a-z0-9-]+\.[a-z]{2,}$/i.test(parsed.hostname)) {
      return { ok: false, href: value, display: value, error: "Please enter a valid project URL." };
    }
    const display = `${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`.replace(/\/$/, "");
    return { ok: true, href: parsed.toString(), display };
  } catch {
    return { ok: false, href: value, display: value, error: "Please enter a valid project URL." };
  }
}

function projectCorpus(project) {
  return [
    projectName(project),
    project && project.description,
    projectUrl(project),
    projectTechnologies(project).join(" "),
    projectBulletTexts(project).join(" "),
  ]
    .map(text)
    .filter(Boolean)
    .join("\n");
}

function normalizeProject(project, index = 0) {
  const source = project && typeof project === "object" ? project : {};
  const name = projectName(source);
  const url = projectUrl(source);
  const bullets = projectBulletEntries(source);
  return {
    ...source,
    id: source.id || `project-${index + 1}`,
    name,
    title: name,
    description: source.description || "",
    link: url,
    url,
    technologies: projectTechnologies(source),
    bullets,
    bulletPoints: bullets.map((b) => b.text),
    startDate: source.startDate || "",
    endDate: source.endDate || "",
  };
}

module.exports = {
  text,
  projectBulletEntries,
  projectBulletTexts,
  projectTechnologies,
  projectUrl,
  projectName,
  projectCorpus,
  normalizeProjectUrl,
  normalizeProject,
};
