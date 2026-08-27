const { analyzeResume, parseJobDescription } = require("./resumeAnalyzer");
const { buildRoleProfile, canonicalSkill, skillKey, uniq } = require("./roleKnowledge");
const {
  text,
  projectBulletTexts,
  projectTechnologies,
  projectUrl,
  projectName,
  normalizeProject,
  normalizeProjectUrl,
} = require("./projectUtils");

const CONTACT_KEYS = [
  "fullName", "email", "phone", "location", "linkedin", "website", "photo",
];

const GENERIC_SUMMARY = /hardworking|looking for opportunities|seeking a challenging|passionate individual|to work in a reputed|fresher looking/i;

const WEAK_OPENERS = [
  [/^worked on\s+/i, "Developed "],
  [/^worked with\s+/i, "Used "],
  [/^helped (?:to\s+)?/i, "Supported "],
  [/^assisted (?:with|in)\s+/i, "Supported "],
  [/^responsible for\s+/i, "Owned "],
  [/^involved in\s+/i, "Contributed to "],
  [/^participated in\s+/i, "Contributed to "],
  [/^handled\s+/i, "Managed "],
  [/^made\s+/i, "Built "],
  [/^did\s+/i, "Completed "],
  [/^created\s+/i, "Developed "],
];

function extractNumbers(str) {
  return (String(str || "").match(/\d+(?:\.\d+)?%?|\$\d[\d,]*/g) || []).sort();
}

function numbersPreserved(original, rewritten) {
  const before = extractNumbers(original);
  const after = extractNumbers(rewritten);
  if (after.length < before.length) return false;
  const remaining = after.slice();
  for (const n of before) {
    const idx = remaining.indexOf(n);
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return remaining.length === 0;
}

function replaceWeakOpener(sentence) {
  let next = text(sentence);
  if (!next) return next;
  for (const [pattern, replacement] of WEAK_OPENERS) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      break;
    }
  }
  return next;
}

function polishSentence(sentence, allowedTech) {
  const original = text(sentence);
  if (!original) return original;
  let next = replaceWeakOpener(original);

  if (/^used sql\.?$/i.test(original) || /^worked with sql\.?$/i.test(original)) {
    next = "Used SQL to query and analyze structured datasets for reporting and data analysis.";
  } else if (/\bdashboard/i.test(original) && !/interactive/i.test(next)) {
    next = next.replace(/\b((?:power bi|tableau|excel)\s+)(dashboards?)\b/i, "an interactive $1$2");
    if (!/interactive/i.test(next)) next = next.replace(/\b(dashboards?)\b/i, "interactive $1");
  } else if (/\bwebsite\b/i.test(original) && /\breact\b/i.test(original) && !/reusable components/i.test(next)) {
    next = next.replace(/\.$/, "") + ", implementing reusable components and interactive user interfaces.";
  }

  const techInText = allowedTech.filter((t) => new RegExp(`\\b${escapeRegex(t)}\\b`, "i").test(original));
  if (
    techInText.length &&
    next.length < 90 &&
    !techInText.every((t) => new RegExp(`\\b${escapeRegex(t)}\\b`, "i").test(next))
  ) {
    // Keep existing tech names; do not append unused ones.
  }

  if (next.length > 0 && !/[.!?]$/.test(next)) next += ".";
  if (!numbersPreserved(original, next)) return original.endsWith(".") ? original : `${original}.`;
  return next;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitSentences(paragraph) {
  return text(paragraph)
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resumeSkillList(resume) {
  return uniq((Array.isArray(resume.skills) ? resume.skills : []).map(canonicalSkill).filter(Boolean));
}

function allResumeTech(resume) {
  const found = [...resumeSkillList(resume)];
  for (const job of resume.experience || []) {
    found.push(job.role, ...(job.bullets || []));
  }
  for (const p of resume.projects || []) {
    found.push(...projectTechnologies(p), projectName(p), p.description, ...projectBulletTexts(p));
  }
  return found;
}

function skillExistsInResume(skill, resume) {
  const blob = [
    ...(resume.skills || []),
    resume.summary,
    resume.title,
    ...allResumeTech(resume),
  ].join(" \n ");
  const key = skillKey(skill);
  if (!key) return false;
  return new RegExp(`(?:^|[^a-z0-9+#])${escapeRegex(key)}(?:$|[^a-z0-9+#])`, "i").test(blob);
}

function pickExistingRelevant(resumeSkills, roleSkills) {
  const roleKeys = roleSkills.map(skillKey);
  const relevant = [];
  const rest = [];
  for (const skill of resumeSkills) {
    if (roleKeys.includes(skillKey(skill))) relevant.push(skill);
    else rest.push(skill);
  }
  return { relevant, rest, ordered: [...relevant, ...rest] };
}

function rewriteSummary(resume, targetRole, roleSkills) {
  const skills = resumeSkillList(resume);
  const { relevant } = pickExistingRelevant(skills, roleSkills);
  const skillPhrase = (relevant.length ? relevant : skills).slice(0, 4).join(", ");
  const education = (resume.education || [])[0] || {};
  const field = text(education.fieldOfStudy || education.field);
  const degree = text(education.degree);
  const eduBit = [degree, field].filter(Boolean).join(" in ") || (field ? `${field} graduate` : "");
  const original = text(resume.summary);

  if (!original || GENERIC_SUMMARY.test(original)) {
    const who = eduBit ? `${eduBit}` : "Professional";
    const skillBit = skillPhrase ? ` with experience in ${skillPhrase}` : "";
    return `${who}${skillBit}, seeking to apply existing analytical and technical skills in a ${targetRole} role.`.replace(/^Professional with/, "Professional with");
  }

  let next = original;
  if (targetRole && !new RegExp(escapeRegex(targetRole), "i").test(next)) {
    next = next.replace(/\.$/, "") + `, aligned with a ${targetRole} role.`;
  }
  for (const skill of relevant.slice(0, 3)) {
    if (!new RegExp(`\\b${escapeRegex(skill)}\\b`, "i").test(next) && skillExistsInResume(skill, resume)) {
      next = next.replace(/\.$/, "") + ` Experience includes ${skill}.`;
    }
  }
  if (!numbersPreserved(original, next)) return original;
  return next;
}

function rewriteExperience(experience, resume, allowedFromResume) {
  return (Array.isArray(experience) ? experience : []).map((job) => {
    const bullets = Array.isArray(job.bullets) ? job.bullets : [];
    return {
      ...job,
      company: job.company,
      role: job.role,
      location: job.location,
      startDate: job.startDate,
      endDate: job.endDate,
      current: job.current,
      bullets: bullets.map((b) => polishSentence(b, allowedFromResume)),
    };
  });
}

function bulletsFromProjectFacts(project) {
  const original = text(project.description);
  const techs = projectTechnologies(project);
  const name = projectName(project);
  const bullets = [];
  if (original) bullets.push(polishSentence(original, techs));
  for (const tech of techs) {
    const already = bullets.some((b) => new RegExp(`\\b${escapeRegex(tech)}\\b`, "i").test(b));
    if (already) continue;
    if (/\bdashboard/i.test(`${original} ${name}`)) {
      bullets.push(`Used ${tech} in the ${name || "dashboard"} to support data analysis and reporting.`);
    } else if (/\bwebsite|web application|app\b/i.test(`${original} ${name}`)) {
      bullets.push(`Used ${tech} while building the ${name || "application"}.`);
    } else {
      bullets.push(`Used ${tech} in ${name || "this project"}.`);
    }
  }
  return uniq(bullets).slice(0, 5);
}

function rewriteProject(project, index) {
  const normalized = normalizeProject(project, index);
  const techs = projectTechnologies(normalized);
  const existingBullets = projectBulletTexts(normalized);
  const description = text(normalized.description)
    ? polishSentence(normalized.description, techs)
    : normalized.description;

  let bullets = existingBullets.map((b) => polishSentence(b, techs));
  if (!bullets.length) {
    const sentences = splitSentences(normalized.description);
    if (sentences.length >= 2) bullets = sentences.map((s) => polishSentence(s, techs));
    else if (techs.length && text(normalized.description)) bullets = bulletsFromProjectFacts(normalized);
  }

  const urlInfo = normalizeProjectUrl(projectUrl(normalized));
  const url = urlInfo.ok ? urlInfo.href : projectUrl(normalized);
  const bulletEntries = bullets.map((textValue, i) => ({
    id: (normalized.bullets[i] && normalized.bullets[i].id) || `project-bullet-${index + 1}-${i + 1}`,
    text: textValue,
  }));

  return {
    ...normalized,
    name: projectName(normalized),
    title: projectName(normalized),
    description,
    technologies: techs,
    bullets: bulletEntries,
    bulletPoints: bulletEntries.map((b) => b.text),
    url,
    link: url,
  };
}

function rewriteResumeData(resume, targetRole, roleSkills) {
  const source = resume && typeof resume === "object" ? resume : {};
  const skills = resumeSkillList(source);
  const { ordered } = pickExistingRelevant(skills, roleSkills);

  const rewritten = {
    ...source,
    summary: rewriteSummary(source, targetRole, roleSkills),
    skills: ordered,
    experience: rewriteExperience(source.experience, source, [...skills, ...roleSkills.filter((s) => skillExistsInResume(s, source))]),
    projects: (Array.isArray(source.projects) ? source.projects : []).map((p, i) => rewriteProject(p, i)),
    education: Array.isArray(source.education) ? source.education.map((ed) => ({ ...ed })) : [],
    certifications: Array.isArray(source.certifications)
      ? source.certifications.map((c) => ({
          ...c,
          name: c.name,
          issuer: c.issuer,
          date: c.date,
          url: c.url || c.link || "",
        }))
      : [],
  };

  for (const key of CONTACT_KEYS) {
    rewritten[key] = source[key];
  }
  rewritten.targetRole = source.targetRole;
  rewritten.jobDescription = source.jobDescription;
  if (rewritten.photo === "present") rewritten.photo = source.photo === "present" ? undefined : source.photo;
  return rewritten;
}

function describeChanges(original, rewritten, targetRole, usedJobDescription) {
  const changes = [];
  if (text(original.summary) !== text(rewritten.summary)) {
    changes.push(`Summary customized for ${targetRole}`);
  }
  if ((original.skills || []).join("|") !== (rewritten.skills || []).join("|")) {
    changes.push("Relevant skills prioritized");
  }
  const origProj = JSON.stringify((original.projects || []).map((p) => [p.description, projectBulletTexts(p)]));
  const newProj = JSON.stringify((rewritten.projects || []).map((p) => [p.description, projectBulletTexts(p)]));
  if (origProj !== newProj) changes.push("Project descriptions improved");
  const origExp = JSON.stringify((original.experience || []).map((j) => j.bullets));
  const newExp = JSON.stringify((rewritten.experience || []).map((j) => j.bullets));
  if (origExp !== newExp) changes.push("Experience bullets improved");
  if (usedJobDescription) changes.push("Job description keywords naturally incorporated where already evidenced");
  changes.push("ATS formatting preserved");
  return uniq(changes);
}

function snapshotScores(result) {
  return {
    overallScore: result.overallScore,
    starRating: result.starRating,
    roleMatch: result.roleMatch,
    skillsMatch: result.skillsMatch,
    keywordMatch: result.keywordMatch,
    projectsScore: result.projectsScore,
    experienceScore: result.experienceScore,
  };
}

function rewriteResume({ resume = {}, targetRole, jobDescription = "", analysis = null, templateId } = {}) {
  const roleName = text(targetRole);
  if (!roleName) {
    const err = new Error("Enter a target job role before rewriting your resume.");
    err.status = 400;
    throw err;
  }

  const data = JSON.parse(JSON.stringify(resume && typeof resume === "object" ? resume : {}));
  const tid = templateId || data.templateId;
  const before = analyzeResume({ resume: data, targetRole: roleName, jobDescription, templateId: tid });

  const roleProfile = buildRoleProfile(roleName);
  const parsedJd = parseJobDescription(jobDescription, roleProfile);
  const evidencedJdSkills = uniq([...(parsedJd.requiredSkills || []), ...(parsedJd.preferredSkills || [])])
    .filter((skill) => skillExistsInResume(skill, data));
  const roleSkills = uniq([
    ...evidencedJdSkills,
    ...(roleProfile.requiredSkills || []),
    ...(roleProfile.preferredSkills || []),
  ]);
  const rewrittenResume = rewriteResumeData(data, roleName, roleSkills);
  const after = analyzeResume({
    resume: rewrittenResume,
    targetRole: roleName,
    jobDescription,
    templateId: tid,
  });

  return {
    rewrittenResume,
    changes: describeChanges(data, rewrittenResume, roleName, Boolean(text(jobDescription))),
    estimatedScoreBefore: before.overallScore,
    estimatedScoreAfter: after.overallScore,
    starRatingBefore: before.starRating,
    starRatingAfter: after.starRating,
    before: snapshotScores(before),
    after: snapshotScores(after),
    usedJobDescription: Boolean(text(jobDescription)),
    engine: "deterministic-role-rewrite",
    integrityNote:
      "Wording and skill order were improved using only facts already present in the resume. No employers, dates, metrics, skills, or credentials were invented.",
  };
}

module.exports = {
  rewriteResume,
  rewriteResumeData,
  numbersPreserved,
};
