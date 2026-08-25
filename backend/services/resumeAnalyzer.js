const { ATS_WEIGHTS } = require("./atsWeights");
const { getTemplateProfile } = require("./templateProfiles");
const {
  KNOWN_SKILLS,
  canonicalSkill,
  skillKey,
  normalizeKey,
  buildRoleProfile,
  uniq,
} = require("./roleKnowledge");
const {
  projectBulletTexts,
  projectTechnologies,
  projectUrl,
  projectName,
  projectCorpus,
} = require("./projectUtils");

const MAX_JOB_DESCRIPTION = 50000;

const WEAK_VERBS = [
  "worked on", "worked with", "helped", "assisted", "responsible for",
  "tasked with", "involved in", "participated in", "handled", "did",
  "made", "used",
];

const STRONG_VERBS = [
  "developed", "built", "designed", "implemented", "led", "reduced",
  "increased", "automated", "created", "launched", "optimized", "delivered",
  "improved", "migrated", "architected", "established", "streamlined",
  "achieved", "drove", "owned", "spearheaded", "cut", "saved", "grew",
];

const GENERIC_PHRASES = [
  "team player", "hard working", "hardworking", "detail oriented",
  "detail-oriented", "self starter", "self-starter", "go getter",
  "passionate individual", "results driven", "results-driven",
  "various tasks", "day to day operations", "duties as assigned",
];

const STOP_KEYWORDS = new Set([
  "the", "and", "for", "with", "you", "our", "are", "will", "this", "that",
  "from", "your", "have", "has", "was", "were", "their", "they", "who",
  "job", "role", "team", "work", "ability", "skills", "experience", "years",
  "year", "including", "using", "across", "into", "about", "other", "such",
  "well", "also", "plus", "etc", "must", "should", "able", "good", "strong",
  "looking", "candidate", "position", "company", "we", "us", "be", "or",
  "in", "on", "to", "of", "a", "an", "as", "at", "by", "is", "it",
]);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function round1(n) {
  return Math.round(Number(n) * 10) / 10;
}

function roundScore(n) {
  return clamp(Math.round(Number(n) || 0), 0, 100);
}

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resumeCorpus(resume) {
  const parts = [
    resume.fullName,
    resume.title,
    resume.summary,
    resume.email,
    resume.phone,
    resume.location,
    resume.linkedin,
    resume.website,
    asList(resume.skills).join(" "),
  ];
  for (const job of asList(resume.experience)) {
    parts.push(job.company, job.role, job.location, job.startDate, job.endDate, asList(job.bullets).join(" "));
  }
  for (const ed of asList(resume.education)) {
    parts.push(ed.institution, ed.school, ed.degree, ed.fieldOfStudy, ed.field, ed.level, ed.location, ed.grade);
  }
  for (const p of asList(resume.projects)) {
    parts.push(projectCorpus(p));
  }
  for (const c of asList(resume.certifications)) {
    parts.push(c.name, c.issuer, c.date, c.url, c.link);
  }
  return parts.map(text).filter(Boolean).join("\n");
}

function visibleExperience(resume) {
  return asList(resume.experience).filter((job) =>
    text(job.role) || text(job.company) || asList(job.bullets).some((b) => text(b))
  );
}

function visibleProjects(resume) {
  return asList(resume.projects).filter((p) =>
    projectName(p) || text(p.description) || projectBulletTexts(p).length
  );
}

function visibleEducation(resume) {
  return asList(resume.education).filter((ed) =>
    text(ed.institution) || text(ed.school) || text(ed.degree) || text(ed.fieldOfStudy) || text(ed.field)
  );
}

function visibleCerts(resume) {
  return asList(resume.certifications).filter((c) => text(c.name));
}

function resumeSkills(resume) {
  return uniq(asList(resume.skills).map(canonicalSkill).filter(Boolean));
}

function skillPattern(skill) {
  const canonical = canonicalSkill(skill);
  const key = skillKey(canonical);
  if (!key) return null;
  const compact = key.replace(/\s+/g, "");
  const edge = String.raw`(?:^|[^a-z0-9+#])`;
  const tail = String.raw`(?=$|[^a-z0-9+#])`;
  if (key.length <= 2 || ["r", "c", "go", "c#", "c++", "qa", "hr", "bi"].includes(key)) {
    return new RegExp(`${edge}${escapeRegex(key)}${tail}`, "i");
  }
  const spaced = escapeRegex(key).replace(/\\ /g, "[\\s._-]*");
  const compactPat = escapeRegex(compact);
  if (compact === key.replace(/\s+/g, "")) {
    return new RegExp(`${edge}(?:${spaced}|${compactPat})${tail}`, "i");
  }
  return new RegExp(`${edge}(?:${spaced})${tail}`, "i");
}

function corpusHasSkill(corpus, skill) {
  const pattern = skillPattern(skill);
  if (!pattern) return false;
  return pattern.test(corpus);
}

function countOccurrences(corpus, skill) {
  const pattern = skillPattern(skill);
  if (!pattern) return 0;
  const global = new RegExp(pattern.source, "gi");
  const matches = corpus.match(global);
  return matches ? matches.length : 0;
}

function tokenizeOverlap(a, b) {
  const ta = new Set(normalizeKey(a).split(" ").filter((t) => t.length > 2 && !STOP_KEYWORDS.has(t)));
  const tb = new Set(normalizeKey(b).split(" ").filter((t) => t.length > 2 && !STOP_KEYWORDS.has(t)));
  if (!ta.size || !tb.size) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit += 1;
  return hit / Math.max(ta.size, tb.size);
}

function hasMetric(str) {
  return /\d+\s*%|\$\s*\d|\d+\s*\+|increased|reduced|decreased|improved|saved|grew|cut by|by \d/i.test(text(str));
}

function hasStrongVerb(str) {
  const n = text(str).toLowerCase();
  return STRONG_VERBS.some((v) => n.startsWith(v) || n.includes(` ${v} `));
}

function hasWeakVerb(str) {
  const n = text(str).toLowerCase();
  return WEAK_VERBS.some((v) => n.startsWith(v) || n.includes(v));
}

function parseYearHint(value) {
  const m = String(value || "").match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

function estimateYears(experience) {
  let total = 0;
  const now = new Date().getFullYear();
  for (const job of experience) {
    const start = parseYearHint(job.startDate);
    const end = job.current ? now : parseYearHint(job.endDate) || start;
    if (start && end && end >= start) total += Math.min(end - start + 0.5, 20);
    else total += 1;
  }
  return round1(total);
}

function evidenceLevel(skill, resume) {
  const skillsText = resumeSkills(resume).join(" \n ");
  const expText = visibleExperience(resume)
    .map((j) => [j.role, j.company, asList(j.bullets).join(" ")].join(" "))
    .join(" \n ");
  const projText = visibleProjects(resume)
    .map((p) => projectCorpus(p))
    .join(" \n ");
  const certText = visibleCerts(resume)
    .map((c) => [c.name, c.issuer, c.url, c.link].join(" "))
    .join(" \n ");

  const inSkills = corpusHasSkill(skillsText, skill);
  const inExp = corpusHasSkill(expText, skill);
  const inProj = corpusHasSkill(projText, skill);
  const inCert = corpusHasSkill(certText, skill);
  const sections = [inSkills, inExp, inProj, inCert].filter(Boolean).length;
  const uses = (inExp ? 1 : 0) + (inProj ? 1 : 0) + (inCert ? 1 : 0);

  if (!inSkills && !inExp && !inProj && !inCert) return { level: "Not found", score: 0, sections, uses };
  if (uses >= 2 && (inCert || hasMetric(expText + " " + projText))) {
    return { level: "Strong Evidence", score: 100, sections, uses };
  }
  if (uses >= 2 || (inExp && inProj)) return { level: "Demonstrated", score: 95, sections, uses };
  if (inExp || inProj || inCert) return { level: "Used", score: 85, sections, uses };
  return { level: "Mentioned", score: 70, sections, uses };
}

function extractSkillsFromText(raw, catalog) {
  const source = text(raw).slice(0, MAX_JOB_DESCRIPTION);
  if (!source) return [];
  const found = [];
  const sorted = [...catalog].sort((a, b) => b.length - a.length);
  for (const skill of sorted) {
    if (corpusHasSkill(source, skill)) found.push(canonicalSkill(skill));
  }
  return uniq(found);
}

function extractKeywordsFromText(raw, extra = []) {
  const source = text(raw).slice(0, MAX_JOB_DESCRIPTION).toLowerCase();
  const words = source.match(/[a-z][a-z0-9+#.]{2,}/g) || [];
  const counts = new Map();
  for (const w of words) {
    if (STOP_KEYWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  const ranked = [...counts.entries()]
    .filter(([, n]) => n >= 1)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 40);
  return uniq([...extra.map((k) => normalizeKey(k)), ...ranked]).slice(0, 40);
}

function splitJdSections(jd) {
  const source = text(jd).slice(0, MAX_JOB_DESCRIPTION);
  const lower = source.toLowerCase();
  const requiredIdx = lower.search(/requirements?|must have|required skills|what you.?ll need|qualifications/);
  const preferredIdx = lower.search(/preferred|nice to have|good to have|bonus|plus/);
  const respIdx = lower.search(/responsibilities|what you.?ll do|the role|duties/);
  return {
    full: source,
    requiredBlock: requiredIdx >= 0 ? source.slice(requiredIdx, preferredIdx > requiredIdx ? preferredIdx : undefined) : "",
    preferredBlock: preferredIdx >= 0 ? source.slice(preferredIdx) : "",
    responsibilityBlock: respIdx >= 0 ? source.slice(respIdx, requiredIdx > respIdx ? requiredIdx : undefined) : source,
  };
}

function parseJobDescription(jobDescription, roleProfile) {
  const jd = text(jobDescription).slice(0, MAX_JOB_DESCRIPTION);
  if (!jd) {
    return {
      used: false,
      requiredSkills: roleProfile.requiredSkills,
      preferredSkills: roleProfile.preferredSkills,
      keywords: roleProfile.keywords,
      tools: roleProfile.requiredSkills,
      responsibilities: roleProfile.responsibilities,
      qualifications: roleProfile.educationFields,
      yearsRequired: null,
    };
  }

  const sections = splitJdSections(jd);
  const catalog = uniq([...KNOWN_SKILLS, ...roleProfile.requiredSkills, ...roleProfile.preferredSkills]);
  const requiredFromJd = extractSkillsFromText(sections.requiredBlock || jd, catalog);
  const preferredFromJd = extractSkillsFromText(sections.preferredBlock, catalog)
    .filter((s) => !requiredFromJd.some((r) => skillKey(r) === skillKey(s)));
  const allFromJd = extractSkillsFromText(jd, catalog);

  // JD required skills take priority. Role knowledge fills gaps as preferred.
  const requiredSkills = requiredFromJd.length ? requiredFromJd : uniq([...allFromJd.slice(0, 12), ...roleProfile.requiredSkills.slice(0, 4)]);
  const preferredSkills = uniq([
    ...preferredFromJd,
    ...roleProfile.requiredSkills,
    ...roleProfile.preferredSkills,
  ]).filter((s) => !requiredSkills.some((r) => skillKey(r) === skillKey(s)));

  const yearMatch = jd.match(/(\d+)\+?\s*\+?\s*(?:years|yrs)/i);
  const keywords = extractKeywordsFromText(jd, [...roleProfile.keywords, ...requiredSkills, ...preferredSkills]);

  return {
    used: true,
    requiredSkills: uniq(requiredSkills.map(canonicalSkill)),
    preferredSkills: uniq(preferredSkills.map(canonicalSkill)).slice(0, 16),
    keywords,
    tools: uniq([...requiredSkills, ...preferredSkills]).slice(0, 20),
    responsibilities: roleProfile.responsibilities,
    qualifications: roleProfile.educationFields,
    yearsRequired: yearMatch ? Number(yearMatch[1]) : null,
    rawLength: jd.length,
  };
}

function calculateStarRating(overallScore) {
  const score = roundScore(overallScore);
  if (score >= 90) return 5.0;
  if (score >= 80) return 4.5;
  if (score >= 70) return 4.0;
  if (score >= 60) return 3.5;
  if (score >= 50) return 3.0;
  if (score >= 40) return 2.5;
  if (score >= 30) return 2.0;
  if (score >= 20) return 1.5;
  if (score >= 10) return 1.0;
  return 0.5;
}

function interpretScore(overallScore) {
  const score = roundScore(overallScore);
  if (score >= 90) return { label: "Excellent Match", band: "excellent" };
  if (score >= 80) return { label: "Strong Match", band: "strong" };
  if (score >= 70) return { label: "Good Match", band: "good" };
  if (score >= 60) return { label: "Needs Improvement", band: "improve" };
  if (score >= 50) return { label: "Weak Match", band: "weak" };
  return { label: "Poor Match", band: "poor" };
}

function calculateSkillsMatch(resume, targets) {
  const required = uniq((targets.requiredSkills || []).map(canonicalSkill));
  const preferred = uniq((targets.preferredSkills || []).map(canonicalSkill))
    .filter((s) => !required.some((r) => skillKey(r) === skillKey(s)));
  const corpus = resumeCorpus(resume);
  const rows = [];

  function rowFor(skill, importance) {
    const evidence = evidenceLevel(skill, resume);
    const found = evidence.score > 0 || corpusHasSkill(corpus, skill);
    return {
      skill,
      importance,
      required: importance === "required",
      found,
      matchScore: found ? 100 : 0,
      evidence: found ? evidence.level : "Not found",
      evidenceScore: found ? evidence.score : 0,
    };
  }

  for (const skill of required) rows.push(rowFor(skill, "required"));
  for (const skill of preferred) rows.push(rowFor(skill, "preferred"));

  const requiredRows = rows.filter((r) => r.importance === "required");
  const preferredRows = rows.filter((r) => r.importance === "preferred");
  const requiredCoverage = requiredRows.length
    ? (requiredRows.filter((r) => r.found).length / requiredRows.length) * 100
    : 0;
  const requiredEvidence = requiredRows.length
    ? requiredRows.reduce((s, r) => s + r.evidenceScore, 0) / requiredRows.length
    : 0;
  const preferredCoverage = preferredRows.length
    ? (preferredRows.filter((r) => r.found).length / preferredRows.length) * 100
    : 0;

  let score;
  if (requiredRows.length) {
    // Coverage of required skills dominates. Preferred skills can raise the
    // score slightly but cannot tank a resume that already has the must-haves.
    score = requiredCoverage * 0.82 + requiredEvidence * 0.12 + preferredCoverage * 0.06;
  } else if (preferredRows.length) {
    score = preferredCoverage * 0.7 + (resumeSkills(resume).length ? 15 : 0);
  } else {
    score = resumeSkills(resume).length ? 55 : 12;
  }

  const missingRequired = requiredRows.filter((r) => !r.found).map((r) => r.skill);
  const matchedRequired = requiredRows.filter((r) => r.found).map((r) => r.skill);

  return {
    score: roundScore(score),
    rows,
    requiredCount: requiredRows.length,
    matchedCount: requiredRows.filter((r) => r.found).length,
    missingCount: missingRequired.length,
    missingSkills: missingRequired,
    matchedSkills: matchedRequired,
    preferredMatched: preferredRows.filter((r) => r.found).length,
    preferredCount: preferredRows.length,
  };
}

function calculateKeywordMatch(resume, targets) {
  const corpus = resumeCorpus(resume).toLowerCase();
  const required = uniq((targets.requiredSkills || []).map((s) => canonicalSkill(s)));
  const preferred = uniq((targets.preferredSkills || []).map((s) => canonicalSkill(s)));
  const extra = uniq((targets.keywords || []).map((k) => text(k))).filter((k) => k.length > 2);

  const requiredKeywords = uniq([...required, ...extra.slice(0, 10)]);
  const optionalKeywords = uniq([...preferred, ...extra.slice(10)]).filter(
    (k) => !requiredKeywords.some((r) => skillKey(r) === skillKey(k) || normalizeKey(r) === normalizeKey(k))
  );

  function present(keyword) {
    if (corpusHasSkill(corpus, keyword)) return true;
    const n = normalizeKey(keyword);
    if (n.length <= 2) return new RegExp(`\\b${escapeRegex(n)}\\b`, "i").test(corpus);
    return corpus.includes(n);
  }

  const matched = requiredKeywords.filter(present);
  const missing = requiredKeywords.filter((k) => !present(k));
  const optionalMatched = optionalKeywords.filter(present);

  const reqScore = requiredKeywords.length ? matched.length / requiredKeywords.length : 0.5;
  const optScore = optionalKeywords.length ? optionalMatched.length / optionalKeywords.length : 0;
  const score = (reqScore * 0.8 + optScore * 0.2) * 100;

  return {
    score: roundScore(score),
    requiredCount: requiredKeywords.length,
    matchedCount: matched.length,
    missingCount: missing.length,
    matchedKeywords: matched,
    missingKeywords: missing.slice(0, 12),
    optionalKeywords: optionalKeywords.slice(0, 10),
    optionalMatched,
  };
}

function calculateRoleMatch(resume, targetRole, roleProfile, skillsResult, keywordResult) {
  const corpus = resumeCorpus(resume);
  const titleNorm = normalizeKey(resume.title || "");
  const roleNorm = normalizeKey(targetRole);
  let titleScore = tokenizeOverlap(resume.title || "", targetRole) * 100;
  if (titleNorm && roleNorm) {
    if (titleNorm === roleNorm) titleScore = 100;
    else if (titleNorm.includes(roleNorm) || roleNorm.includes(titleNorm)) titleScore = Math.max(titleScore, 90);
  }
  titleScore = Math.max(
    titleScore,
    corpusHasSkill(`${resume.title || ""} ${resume.summary || ""}`, targetRole) ? 78 : 0,
    tokenizeOverlap(resume.summary || "", targetRole) * 70
  );
  const summaryHits = (roleProfile.keywords || []).filter((k) => corpusHasSkill(resume.summary || "", k)).length;
  const summaryScore = roleProfile.keywords.length
    ? Math.min(100, (summaryHits / Math.min(roleProfile.keywords.length, 8)) * 100)
    : 40;
  const expText = visibleExperience(resume).map((j) => `${j.role} ${asList(j.bullets).join(" ")}`).join(" ");
  const expTitleHits = visibleExperience(resume).map((j) => tokenizeOverlap(j.role || "", targetRole));
  const expTitleScore = expTitleHits.length ? Math.max(...expTitleHits) * 100 : 20;
  const expKeywordHits = (roleProfile.keywords || []).filter((k) => corpusHasSkill(expText, k)).length;
  const expScore = Math.min(100, expTitleScore * 0.6 + (roleProfile.keywords.length ? (expKeywordHits / 6) * 40 : 20));

  const projectText = visibleProjects(resume).map((p) => projectCorpus(p)).join(" ");
  const projHits = uniq([...(roleProfile.requiredSkills || []), ...(roleProfile.keywords || [])])
    .filter((k) => corpusHasSkill(projectText, k)).length;
  const projScore = visibleProjects(resume).length
    ? Math.min(100, 30 + projHits * 10)
    : 25;

  const certText = visibleCerts(resume).map((c) => c.name).join(" ");
  const certHits = (roleProfile.certifications || []).filter((c) => tokenizeOverlap(certText, c) > 0.3 || corpusHasSkill(certText, c)).length;
  const certScore = visibleCerts(resume).length ? Math.min(100, 50 + certHits * 20) : 40;

  const blended =
    titleScore * 0.22 +
    summaryScore * 0.18 +
    skillsResult.score * 0.28 +
    expScore * 0.16 +
    projScore * 0.1 +
    certScore * 0.06;

  // Keyword match is part of "Role & Keyword Match" in the overall model.
  const withKeywords = blended * 0.7 + keywordResult.score * 0.3;
  const emptyPenalty = corpus.replace(/\s+/g, "").length < 40 ? 18 : withKeywords;

  return {
    score: roundScore(emptyPenalty),
    titleAlignment: roundScore(titleScore),
    summaryAlignment: roundScore(summaryScore),
    experienceAlignment: roundScore(expScore),
    projectAlignment: roundScore(projScore),
    certificationAlignment: roundScore(certScore),
  };
}

function calculateExperienceScore(resume, targetRole, roleProfile, targets) {
  const jobs = visibleExperience(resume);
  if (!jobs.length) {
    const hasProjects = visibleProjects(resume).length > 0;
    return {
      score: hasProjects ? 38 : 18,
      years: 0,
      roleRelevance: 0,
      skillEvidence: 0,
      achievementQuality: 0,
      jobs: [],
      notes: ["No work experience entries found. Projects and skills can still support an entry-level match."],
    };
  }

  const years = estimateYears(jobs);
  const requiredSkills = targets.requiredSkills || [];
  const jobRows = jobs.map((job) => {
    const blob = `${job.role} ${job.company} ${asList(job.bullets).join(" ")}`;
    const relevance = roundScore(
      Math.max(tokenizeOverlap(job.role || "", targetRole) * 100, 20) +
        requiredSkills.filter((s) => corpusHasSkill(blob, s)).length * 8
    );
    const bullets = asList(job.bullets).map(text).filter(Boolean);
    const measured = bullets.filter(hasMetric).length;
    const strong = bullets.filter(hasStrongVerb).length;
    const weak = bullets.filter(hasWeakVerb).length;
    const achievement = bullets.length
      ? roundScore((measured / bullets.length) * 55 + (strong / bullets.length) * 35 + 10 - weak * 4)
      : 28;
    return {
      role: job.role || "Untitled role",
      company: job.company || "",
      relevance: clamp(relevance, 0, 100),
      achievementQuality: achievement,
      bulletCount: bullets.length,
      measuredBullets: measured,
      weakBullets: weak,
    };
  });

  const roleRelevance = roundScore(jobRows.reduce((s, r) => s + r.relevance, 0) / jobRows.length);
  const achievementQuality = roundScore(jobRows.reduce((s, r) => s + r.achievementQuality, 0) / jobRows.length);
  const skillEvidence = roundScore(
    requiredSkills.length
      ? (requiredSkills.filter((s) => jobs.some((j) => corpusHasSkill(`${j.role} ${asList(j.bullets).join(" ")}`, s))).length /
          requiredSkills.length) * 100
      : 50
  );

  let yearsScore = 70;
  if (targets.yearsRequired) {
    yearsScore = clamp((years / targets.yearsRequired) * 100, 35, 100);
  } else if (years >= 2) yearsScore = 82;
  else if (years >= 1) yearsScore = 70;
  else yearsScore = 58;

  const progression = jobs.length >= 2 ? 8 : 0;
  const score = roleRelevance * 0.4 + skillEvidence * 0.25 + achievementQuality * 0.2 + yearsScore * 0.15 + progression;

  return {
    score: roundScore(score),
    years,
    roleRelevance,
    skillEvidence,
    achievementQuality,
    yearsRequired: targets.yearsRequired,
    jobs: jobRows,
    notes: [],
  };
}

function calculateProjectScore(resume, targetRole, roleProfile, targets) {
  const projects = visibleProjects(resume);
  if (!projects.length) {
    const familySkipsProjects = ["people", "finance", "management"].includes(roleProfile.family);
    return {
      score: familySkipsProjects ? 58 : 32,
      projects: [],
      notes: ["No projects listed. Add relevant projects if you have them — do not invent any."],
    };
  }

  const required = targets.requiredSkills || [];
  const keywords = uniq([...(roleProfile.keywords || []), targetRole]);
  const rows = projects.map((p) => {
    const bullets = projectBulletTexts(p);
    const techs = projectTechnologies(p);
    const url = projectUrl(p);
    const blob = projectCorpus(p);
    const combinedText = `${text(p.description)} ${bullets.join(" ")}`;
    const techHits = required.filter((s) => corpusHasSkill(blob, s) || techs.some((t) => skillKey(t) === skillKey(s))).length;
    const keywordHits = keywords.filter((k) => corpusHasSkill(blob, k)).length;
    const roleRelevance = roundScore(Math.min(100, 18 + techHits * 14 + keywordHits * 8 + tokenizeOverlap(blob, targetRole) * 40));
    const technicalSkills = required.length
      ? roundScore((techHits / Math.min(required.length, 8)) * 100)
      : roundScore(40 + Math.min(combinedText.length / 4, 40) + Math.min(techs.length * 6, 24));
    const problemDefinition = combinedText.length >= 80 ? 82 : combinedText.length >= 40 ? 68 : 42;
    const impact = hasMetric(combinedText)
      ? 86
      : /built|developed|created|implemented|designed/i.test(combinedText) ? 62 : 45;
    const descriptionQuality = text(p.description)
      ? clamp(30 + Math.min(text(p.description).length / 3, 50) + (hasStrongVerb(p.description) ? 10 : 0), 0, 100)
      : bullets.length ? 58 : 28;
    const measuredBullets = bullets.filter(hasMetric).length;
    const strongBullets = bullets.filter(hasStrongVerb).length;
    const bulletQuality = bullets.length
      ? roundScore((strongBullets / bullets.length) * 45 + (measuredBullets / bullets.length) * 25 + Math.min(bullets.length * 8, 30))
      : 55;
    const technologiesScore = techs.length
      ? roundScore(Math.min(100, 55 + techs.length * 10 + techHits * 8))
      : roundScore(technicalSkills * 0.7);
    const urlProvided = Boolean(url);
    const urlScore = urlProvided ? 100 : 78;
    const overall =
      roleRelevance * 0.24 +
      technicalSkills * 0.16 +
      descriptionQuality * 0.14 +
      bulletQuality * 0.14 +
      impact * 0.12 +
      problemDefinition * 0.1 +
      technologiesScore * 0.07 +
      urlScore * 0.03;
    const missing = [];
    if (!hasMetric(combinedText)) {
      missing.push("Add measurable impact such as users, data volume, time saved, accuracy, or revenue only if truthful.");
    }
    if (text(p.description).length < 60 && !bullets.length) {
      missing.push("Expand the description with the problem, approach, and outcome, or add project bullet points.");
    }
    if (techHits === 0) missing.push(`Mention role-relevant tools only if they were actually used in ${projectName(p) || "this project"}.`);
    if (!urlProvided) missing.push("A project URL is optional. Add a GitHub, demo, or portfolio link if you have one.");
    return {
      name: projectName(p) || "Untitled project",
      roleRelevance: roundScore(roleRelevance),
      technicalSkills: roundScore(technicalSkills),
      problemDefinition: roundScore(problemDefinition),
      impact: roundScore(impact),
      descriptionQuality: roundScore(descriptionQuality),
      bulletQuality: roundScore(bulletQuality),
      technologiesScore: roundScore(technologiesScore),
      technologies: techs,
      urlProvided,
      urlLabel: urlProvided ? "Provided" : "Optional / Not provided",
      overall: roundScore(overall),
      missing,
    };
  });

  const score = rows.reduce((s, r) => s + r.overall, 0) / rows.length;
  return { score: roundScore(score), projects: rows, notes: [] };
}

function calculateCertificationScore(resume, roleProfile, targets) {
  const certs = visibleCerts(resume);
  const relevantNames = uniq([...(roleProfile.certifications || []), ...(targets.requiredSkills || []), ...(targets.preferredSkills || [])]);
  if (!certs.length) {
    const jdWantsCert = /\bcertif/i.test(JSON.stringify(targets.keywords || []));
    return {
      score: jdWantsCert ? 42 : 56,
      certifications: [],
      notes: ["No certifications listed. This is optional unless the job description requires one — do not add credentials you do not hold."],
    };
  }

  const rows = certs.map((c) => {
    const blob = `${c.name} ${c.issuer || ""}`;
    let relevanceScore = 28;
    let label = "Low Relevance";
    for (const rel of relevantNames) {
      const overlap = Math.max(tokenizeOverlap(blob, rel), corpusHasSkill(blob, rel) ? 0.8 : 0);
      if (overlap >= 0.45) {
        relevanceScore = Math.max(relevanceScore, 92);
        label = "Highly Relevant";
      } else if (overlap >= 0.2) {
        relevanceScore = Math.max(relevanceScore, 68);
        if (label !== "Highly Relevant") label = "Relevant";
      }
    }
    const complete = text(c.name) && (text(c.issuer) || text(c.date)) ? 8 : 0;
    const urlProvided = Boolean(text(c.url || c.link));
    return {
      name: c.name,
      issuer: c.issuer || "",
      date: c.date || "",
      url: text(c.url || c.link),
      urlProvided,
      urlLabel: urlProvided ? "Certificate URL provided" : "Optional / Not provided",
      relevance: label,
      relevanceScore: roundScore(relevanceScore + complete),
      status: "Listed",
    };
  });

  const best = Math.max(...rows.map((r) => r.relevanceScore));
  const avg = rows.reduce((s, r) => s + r.relevanceScore, 0) / rows.length;
  // Unrelated optional certs should not drag the score down heavily.
  const score = Math.max(62, avg * 0.45 + best * 0.55);
  return { score: roundScore(score), certifications: rows, notes: [] };
}

function calculateEducationScore(resume, roleProfile, skillsResult, experienceResult) {
  const eds = visibleEducation(resume);
  if (!eds.length) {
    return {
      score: 34,
      items: [],
      notes: ["No education listed. Add qualifications you actually hold."],
      relevance: "Missing",
    };
  }

  const fields = (roleProfile.educationFields || []).map(normalizeKey);
  const items = eds.map((ed) => {
    const blob = `${ed.degree} ${ed.fieldOfStudy || ed.field} ${ed.institution || ed.school} ${ed.level}`;
    const n = normalizeKey(blob);
    const fieldHit = fields.some((f) => f && n.includes(f));
    const complete = [ed.institution || ed.school, ed.degree, ed.fieldOfStudy || ed.field, ed.startDate || ed.endDate]
      .filter((v) => text(v)).length;
    let relevance = "Related";
    let relScore = 70;
    if (fieldHit) {
      relevance = "Relevant";
      relScore = 90;
    } else if (skillsResult.score >= 75 || experienceResult.score >= 75) {
      relevance = "Skills and experience compensate for a non-exact field match";
      relScore = 78;
    } else if (!text(ed.fieldOfStudy || ed.field)) {
      relevance = "Field of study not specified";
      relScore = 58;
    } else {
      relevance = "Not an exact field match";
      relScore = 62;
    }
    return {
      heading: [ed.degree, ed.fieldOfStudy || ed.field].filter(Boolean).join(" — ") || ed.level || "Education",
      institution: ed.institution || ed.school || "",
      relevance,
      completeness: roundScore((complete / 4) * 100),
      score: roundScore(relScore * 0.7 + (complete / 4) * 30),
    };
  });

  const best = Math.max(...items.map((i) => i.score));
  return {
    score: roundScore(best),
    items,
    notes: [],
    relevance: items[0].relevance,
  };
}

function calculateATSFormattingScore(resume, templateProfile) {
  const issues = [];
  let score = templateProfile.atsCompatibility || 90;

  if (templateProfile.usesTablesForLayout) {
    score -= 18;
    issues.push("Template appears to use tables for layout, which some ATS parsers mishandle.");
  }
  if (templateProfile.usesSkillBars) {
    score -= 12;
    issues.push("Graphical skill bars are not reliably parsed as skill names.");
  }
  if (templateProfile.usesCharts) {
    score -= 12;
    issues.push("Charts are not machine-readable skill evidence.");
  }
  if (!templateProfile.singleColumn) {
    score -= 10;
    issues.push("Multi-column layouts can scramble reading order in some ATS software.");
  }
  if (!templateProfile.standardHeadings) {
    score -= 8;
    issues.push("Section heading is non-standard.");
  }
  if (!text(resume.email)) {
    score -= 8;
    issues.push("Contact section is missing an email address.");
  }
  if (!text(resume.phone)) {
    score -= 4;
    issues.push("Contact section is missing a phone number.");
  }
  if (!text(resume.linkedin) && !text(resume.website)) {
    score -= 3;
    issues.push("Contact section is missing LinkedIn or a portfolio URL.");
  }
  if (!text(resume.location)) {
    score -= 2;
    issues.push("Location is missing from contact information.");
  }
  if (templateProfile.hasPhoto && resume.photo) {
    score -= 1;
    issues.push("A photo is present. It is optional and does not contain resume text, but some employers prefer no photo.");
  }

  return {
    score: roundScore(score),
    issues,
    checks: {
      singleColumn: !!templateProfile.singleColumn,
      standardHeadings: !!templateProfile.standardHeadings,
      htmlText: true,
      noLayoutTables: !templateProfile.usesTablesForLayout,
      noSkillBars: !templateProfile.usesSkillBars,
      noCharts: !templateProfile.usesCharts,
      contactAsText: true,
      experienceAsText: true,
      educationAsText: true,
      skillsAsText: true,
    },
  };
}

function calculateTemplateScore(templateProfile) {
  return {
    score: roundScore(templateProfile.atsCompatibility),
    name: templateProfile.name,
    atsCompatibility: roundScore(templateProfile.atsCompatibility),
    readingOrder: roundScore(templateProfile.readingOrder),
    typography: roundScore(templateProfile.typography),
    sectionStructure: roundScore(templateProfile.sectionStructure),
    machineReadability: roundScore(templateProfile.machineReadability),
    photoUsage: templateProfile.photoUsage,
    notes: templateProfile.notes || [],
  };
}

function calculateContentQuality(resume, targetRole, experienceResult) {
  const issues = [];
  const summary = text(resume.summary);
  let score = 40;

  const filled = [
    text(resume.fullName),
    text(resume.title),
    text(resume.email),
    summary,
    resumeSkills(resume).length,
    visibleExperience(resume).length,
    visibleEducation(resume).length,
    visibleProjects(resume).length,
  ].filter(Boolean).length;
  score += filled * 4;

  if (summary.length >= 80 && summary.length <= 600) score += 8;
  else if (summary.length > 0) score += 3;
  else issues.push("Add a concise professional summary tailored to the target role.");

  if (summary && tokenizeOverlap(summary, targetRole) < 0.1 && !corpusHasSkill(summary, targetRole)) {
    issues.push("Summary could be more role-specific.");
    score -= 4;
  }

  const bullets = visibleExperience(resume).flatMap((j) => asList(j.bullets).map(text).filter(Boolean));
  const generic = GENERIC_PHRASES.filter((p) => resumeCorpus(resume).toLowerCase().includes(p));
  if (generic.length) {
    score -= generic.length * 3;
    issues.push("Replace generic phrases with specific, truthful accomplishments.");
  }

  const measured = bullets.filter(hasMetric).length;
  if (bullets.length && measured / bullets.length < 0.3) {
    issues.push("Several experience bullets lack measurable achievements.");
    score -= 6;
  }

  const weak = bullets.filter(hasWeakVerb).length;
  if (weak >= 2) {
    issues.push("Replace weak action verbs with stronger, specific verbs where accurate.");
    score -= 4;
  }

  const skillDupes = asList(resume.skills).length - resumeSkills(resume).length;
  if (skillDupes > 0) {
    issues.push("Duplicate skills were ignored during matching.");
    score -= 2;
  }

  if (/\s{3,}|!!|\?\?|[A-Z]{12,}/.test(resumeCorpus(resume))) {
    issues.push("Clean up unusual punctuation or all-caps fragments for a more professional parse.");
    score -= 3;
  }

  score = score * 0.7 + (experienceResult.achievementQuality || 40) * 0.3;
  return {
    score: roundScore(score),
    issues,
    achievementQuality: experienceResult.achievementQuality || 0,
    completeness: roundScore((filled / 8) * 100),
  };
}

function calculateOverallScore(parts) {
  const weighted =
    (parts.roleMatch * ATS_WEIGHTS.roleMatch +
      parts.skills * ATS_WEIGHTS.skills +
      parts.experience * ATS_WEIGHTS.experience +
      parts.projects * ATS_WEIGHTS.projects +
      parts.certifications * ATS_WEIGHTS.certifications +
      parts.education * ATS_WEIGHTS.education +
      parts.formatting * ATS_WEIGHTS.formatting +
      parts.contentQuality * ATS_WEIGHTS.contentQuality) /
    100;
  return roundScore(weighted);
}

function buildInsights({
  targetRole,
  roleProfile,
  skills,
  keywords,
  experience,
  projects,
  certs,
  education,
  formatting,
  content,
  template,
  overall,
}) {
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];

  if (skills.score >= 75) strengths.push(`Strong coverage of ${targetRole} skills`);
  if (skills.matchedCount >= 3) strengths.push(`Matched ${skills.matchedCount} required skills including ${skills.matchedSkills.slice(0, 3).join(", ")}`);
  if (projects.projects.some((p) => p.roleRelevance >= 75)) {
    strengths.push("At least one project is clearly relevant to the target role");
  }
  if (template.score >= 90) strengths.push(`ATS-friendly template (${template.name})`);
  if (education.score >= 80) strengths.push("Education is present and reasonably aligned");
  if ((experience.achievementQuality || 0) >= 70) strengths.push("Experience bullets include measurable or action-oriented results");
  if (certs.certifications.some((c) => c.relevance === "Highly Relevant")) {
    strengths.push("At least one highly relevant certification is listed");
  }
  if (formatting.score >= 90) strengths.push("Contact and body content are stored as readable text");
  if (keywords.score >= 75) strengths.push("Strong keyword overlap with the target role or job description");

  if (skills.missingSkills.length) {
    weaknesses.push(`${skills.missingSkills.slice(0, 3).join(", ")} ${skills.missingSkills.length === 1 ? "is" : "are"} missing from the resume`);
    recommendations.push({
      priority: "HIGH",
      text: `Add ${skills.missingSkills.slice(0, 3).join(", ")} only if you genuinely have that experience. Do not invent skills.`,
    });
  }
  if (keywords.missingKeywords.length) {
    weaknesses.push("The job description or role profile contains keywords not present in the resume");
    recommendations.push({
      priority: "MEDIUM",
      text: `Where truthful, mention ${keywords.missingKeywords.slice(0, 4).join(", ")} naturally in experience or projects. Do not keyword-stuff.`,
    });
  }
  if ((experience.jobs || []).length) {
    const weakJobs = experience.jobs.filter((j) => j.achievementQuality < 70);
    if (weakJobs.length) {
      const bulletGap = experience.jobs.reduce((s, j) => s + Math.max(0, j.bulletCount - j.measuredBullets), 0);
      weaknesses.push("Several experience bullets lack measurable achievements");
      recommendations.push({
        priority: "HIGH",
        text: `Add measurable outcomes to ${Math.min(Math.max(bulletGap, 2), 5)} experience bullets using real numbers only.`,
      });
    }
    if (experience.roleRelevance < 60) {
      weaknesses.push("Work history is only weakly aligned with the target role");
      recommendations.push({
        priority: "MEDIUM",
        text: "Emphasize the most role-relevant responsibilities you actually performed. Do not rewrite your job title untruthfully.",
      });
    }
  } else {
    weaknesses.push("No work experience is listed");
    recommendations.push({
      priority: "MEDIUM",
      text: "If you have internships, freelance, or volunteer work, add them. Otherwise lean on truthful academic or personal projects.",
    });
  }
  if (!projects.projects.length) {
    weaknesses.push("No projects are listed");
    recommendations.push({
      priority: "LOW",
      text: "Add a relevant project only if you have one. Describe the problem, tools, and outcome without inventing metrics.",
    });
  } else if (projects.projects.every((p) => p.roleRelevance < 55)) {
    weaknesses.push("Listed projects appear weakly related to the target role");
    recommendations.push({
      priority: "MEDIUM",
      text: "If a project used role-relevant tools, say so explicitly. Do not add technologies you did not use.",
    });
  }
  if (content.issues.includes("Summary could be more role-specific.")) {
    weaknesses.push("Summary could be more role-specific");
    recommendations.push({
      priority: "MEDIUM",
      text: `Customize the summary for the ${targetRole} role using skills and experience you already have.`,
    });
  }
  if (formatting.issues.some((i) => /LinkedIn/i.test(i))) {
    weaknesses.push("LinkedIn or portfolio URL is missing");
    recommendations.push({
      priority: "LOW",
      text: "Add a LinkedIn or portfolio URL as plain text if you have one.",
    });
  }
  if (!certs.certifications.length && roleProfile.certifications.length) {
    recommendations.push({
      priority: "LOW",
      text: `Add a relevant certification such as ${roleProfile.certifications[0]} only if you already hold it.`,
    });
  }

  const uniqueStrengths = uniq(strengths).slice(0, 5);
  const uniqueWeaknesses = uniq(weaknesses).slice(0, 5);
  if (!uniqueStrengths.length) uniqueStrengths.push("Resume structure is in place to iterate on");
  if (!uniqueWeaknesses.length && overall < 90) uniqueWeaknesses.push("Tighten role-specific wording where it remains truthful");
  if (!recommendations.length) {
    recommendations.push({
      priority: "LOW",
      text: "Keep the resume factual and re-analyze after any substantial edits.",
    });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  recommendations.sort((a, b) => order[a.priority] - order[b.priority]);

  return {
    strengths: uniqueStrengths,
    weaknesses: uniqueWeaknesses,
    recommendations: recommendations.slice(0, 7),
  };
}

function sectionAnalysis(resume, parts) {
  return [
    {
      section: "Summary",
      present: !!text(resume.summary),
      score: parts.roleMatch.titleAlignment ? roundScore((text(resume.summary).length ? 50 : 10) + parts.roleMatch.summaryAlignment * 0.5) : 0,
      note: text(resume.summary) ? "Summary is present and was compared with the target role." : "Summary is empty.",
    },
    {
      section: "Skills",
      present: resumeSkills(resume).length > 0,
      score: parts.skills.score,
      note: `${parts.skills.matchedCount}/${parts.skills.requiredCount || 0} required skills matched.`,
    },
    {
      section: "Experience",
      present: visibleExperience(resume).length > 0,
      score: parts.experience.score,
      note: visibleExperience(resume).length
        ? `${visibleExperience(resume).length} role(s), estimated ${parts.experience.years} year(s).`
        : "No experience listed.",
    },
    {
      section: "Projects",
      present: visibleProjects(resume).length > 0,
      score: parts.projects.score,
      note: visibleProjects(resume).length ? `${visibleProjects(resume).length} project(s) evaluated.` : "No projects listed.",
    },
    {
      section: "Certifications",
      present: visibleCerts(resume).length > 0,
      score: parts.certs.score,
      note: visibleCerts(resume).length ? `${visibleCerts(resume).length} certification(s) listed.` : "No certifications listed.",
    },
    {
      section: "Education",
      present: visibleEducation(resume).length > 0,
      score: parts.education.score,
      note: parts.education.relevance || "Education evaluated.",
    },
    {
      section: "Contact",
      present: !!(text(resume.email) || text(resume.phone)),
      score: parts.formatting.score,
      note: [resume.email && "Email", resume.phone && "Phone", resume.linkedin && "LinkedIn", resume.location && "Location"]
        .filter(Boolean)
        .join(", ") || "Contact details are incomplete.",
    },
  ];
}

function analyzeResume({ resume = {}, targetRole, jobDescription = "", templateId } = {}) {
  const data = resume && typeof resume === "object" ? resume : {};
  const roleName = text(targetRole);
  if (!roleName) {
    const err = new Error("Enter a target job role to analyze your resume.");
    err.status = 400;
    throw err;
  }

  const roleProfile = buildRoleProfile(roleName);
  const targets = parseJobDescription(jobDescription, roleProfile);
  const templateProfile = getTemplateProfile(templateId || data.templateId);

  const skills = calculateSkillsMatch(data, targets);
  const keywords = calculateKeywordMatch(data, {
    requiredSkills: targets.requiredSkills,
    preferredSkills: targets.preferredSkills,
    keywords: targets.keywords,
  });
  const roleMatch = calculateRoleMatch(data, roleName, roleProfile, skills, keywords);
  const experience = calculateExperienceScore(data, roleName, roleProfile, targets);
  const projects = calculateProjectScore(data, roleName, roleProfile, targets);
  const certs = calculateCertificationScore(data, roleProfile, targets);
  const education = calculateEducationScore(data, roleProfile, skills, experience);
  const formatting = calculateATSFormattingScore(data, templateProfile);
  const template = calculateTemplateScore(templateProfile);
  const content = calculateContentQuality(data, roleName, experience);

  const overallScore = calculateOverallScore({
    roleMatch: roleMatch.score,
    skills: skills.score,
    experience: experience.score,
    projects: projects.score,
    certifications: certs.score,
    education: education.score,
    formatting: formatting.score,
    contentQuality: content.score,
  });
  const starRating = calculateStarRating(overallScore);
  const interpretation = interpretScore(overallScore);
  const insights = buildInsights({
    targetRole: roleName,
    roleProfile,
    skills,
    keywords,
    experience,
    projects,
    certs,
    education,
    formatting,
    content,
    template,
    overall: overallScore,
  });

  return {
    overallScore,
    starRating,
    interpretation: interpretation.label,
    interpretationBand: interpretation.band,
    interpretationDetail: `Your resume is ${interpretation.label.toLowerCase()} for the ${roleName} role based on content, keywords, and ATS-friendly structure.`,
    roleMatch: roleMatch.score,
    skillsMatch: skills.score,
    experienceScore: experience.score,
    projectsScore: projects.score,
    certificationsScore: certs.score,
    educationScore: education.score,
    keywordMatch: keywords.score,
    atsFormatting: formatting.score,
    contentQuality: content.score,
    templateScore: template.score,
    strengths: insights.strengths,
    weaknesses: insights.weaknesses,
    missingKeywords: keywords.missingKeywords,
    missingSkills: skills.missingSkills,
    recommendations: insights.recommendations,
    skillsMatrix: {
      requiredCount: skills.requiredCount,
      matchedCount: skills.matchedCount,
      missingCount: skills.missingCount,
      preferredCount: skills.preferredCount,
      preferredMatched: skills.preferredMatched,
      rows: skills.rows,
    },
    projectMatrix: projects.projects,
    experienceMatrix: {
      years: experience.years,
      yearsRequired: experience.yearsRequired,
      roleRelevance: experience.roleRelevance,
      skillEvidence: experience.skillEvidence,
      achievementQuality: experience.achievementQuality,
      jobs: experience.jobs,
      notes: experience.notes,
    },
    certificationMatrix: certs.certifications,
    educationAnalysis: education,
    keywordAnalysis: {
      requiredCount: keywords.requiredCount,
      matchedCount: keywords.matchedCount,
      missingCount: keywords.missingCount,
      matchedKeywords: keywords.matchedKeywords,
      missingKeywords: keywords.missingKeywords,
      optionalKeywords: keywords.optionalKeywords,
    },
    formattingIssues: formatting.issues,
    formattingChecks: formatting.checks,
    templateAnalysis: template,
    sectionAnalysis: sectionAnalysis(data, {
      roleMatch,
      skills,
      experience,
      projects,
      certs,
      education,
      formatting,
    }),
    usedJobDescription: targets.used,
    roleProfileId: roleProfile.id,
    roleProfileKnown: roleProfile.known,
    weights: { ...ATS_WEIGHTS },
    disclaimer:
      "This score estimates how well your resume matches the selected role and common ATS-friendly resume requirements. Actual ATS scoring varies by employer and applicant tracking system.",
  };
}

module.exports = {
  analyzeResume,
  calculateRoleMatch,
  calculateSkillsMatch,
  calculateExperienceScore,
  calculateProjectScore,
  calculateCertificationScore,
  calculateEducationScore,
  calculateKeywordMatch,
  calculateATSFormattingScore,
  calculateContentQuality,
  calculateTemplateScore,
  calculateOverallScore,
  calculateStarRating,
  parseJobDescription,
};
