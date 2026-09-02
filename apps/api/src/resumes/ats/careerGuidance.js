const { ROLES, ROLE_FAMILIES, buildRoleProfile } = require("./roleKnowledge");
const {
  calculateSkillsMatch,
  calculateExperienceScore,
  calculateRoleMatch,
  calculateProjectScore,
  calculateCertificationScore,
  calculateEducationScore,
  calculateKeywordMatch,
  parseJobDescription,
  interpretScore,
} = require("./resumeAnalyzer");

const FAMILY_LABELS = {
  data: "Data",
  software: "Software",
  frontend: "Frontend",
  backend: "Backend",
  ml: "Machine Learning",
  management: "Management",
  business: "Business",
  people: "People / HR",
  marketing: "Marketing",
  finance: "Finance",
  quality: "Quality",
  design: "Design",
  cloud: "Cloud",
};

function text(value) {
  return String(value == null ? "" : value).trim();
}

function titleCaseRole(role) {
  const raw = text(role && role.titles && role.titles[0]) || role.id || "Role";
  return raw
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["sql", "bi", "hr", "it", "qa", "ui", "ux", "ml"].includes(lower)) return lower.toUpperCase();
      if (lower === "power") return "Power";
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function hasAnalyzableContent(resume) {
  const skills = Array.isArray(resume && resume.skills)
    ? resume.skills.filter((s) => text(s)).length
    : 0;
  const experience = Array.isArray(resume && resume.experience)
    && resume.experience.some((job) => text(job && (job.role || job.company)));
  const projects = Array.isArray(resume && resume.projects)
    && resume.projects.some((p) => text(p && (p.name || p.title || p.description)));
  return skills > 0 || experience || projects;
}

function guidanceBand(score) {
  const interpreted = interpretScore(score);
  if (
    interpreted.label === "Excellent Match"
    || interpreted.label === "Strong Match"
    || interpreted.label === "Good Match"
  ) {
    return interpreted.label;
  }
  return "Potential Match";
}

function whyThisRole(roleTitle, matchedSkills, missingSkills, responsibilities) {
  const matchedBit = matchedSkills.slice(0, 3).join(", ");
  const work = (responsibilities || []).slice(0, 2).filter(Boolean).join(" and ");
  if (matchedBit && work) {
    return `Your resume already shows ${matchedBit}, which this role uses regularly. ${roleTitle} work typically includes ${work}.`;
  }
  if (matchedBit) {
    return `Your current skills in ${matchedBit} give you a practical starting point for ${roleTitle} roles.`;
  }
  const gap = missingSkills[0] ? `, starting with ${missingSkills[0]}` : "";
  return `You can grow into ${roleTitle} by closing a few skill gaps${gap}. Treat this as a direction to practice toward, not a closed door.`;
}

function suggestedNextSteps(role, missingSkills) {
  const steps = [];
  if (missingSkills[0]) {
    steps.push(`Practice ${missingSkills[0]} with a small, truthful example you can describe in an interview.`);
  }
  if (missingSkills[1]) {
    steps.push(`If you have used ${missingSkills[1]}, add it to a project or experience bullet. Do not invent it.`);
  }
  const cert = (role.certifications || [])[0];
  if (cert && steps.length < 3) {
    steps.push(`A credential such as ${cert} can support this path if you plan to earn it. List it only after you hold it.`);
  }
  if (steps.length < 2) {
    steps.push("Add one relevant project that reflects the work this role actually does.");
  }
  if (steps.length < 3) {
    steps.push(`Practice a mock interview for ${titleCaseRole(role)} using examples already on your resume.`);
  }
  return steps.slice(0, 3);
}

function scoreRole(resume, role) {
  const roleTitle = titleCaseRole(role);
  const roleProfile = buildRoleProfile(role.titles[0]);
  const targets = parseJobDescription("", roleProfile);
  const skills = calculateSkillsMatch(resume, targets);
  const keywords = calculateKeywordMatch(resume, {
    requiredSkills: targets.requiredSkills,
    preferredSkills: targets.preferredSkills,
    keywords: targets.keywords,
  });
  const roleMatch = calculateRoleMatch(resume, roleTitle, roleProfile, skills, keywords);
  const experience = calculateExperienceScore(resume, roleTitle, roleProfile, targets);
  const projects = calculateProjectScore(resume, roleTitle, roleProfile, targets);
  const certs = calculateCertificationScore(resume, roleProfile, targets);
  const education = calculateEducationScore(resume, roleProfile, skills, experience);

  const matchScore = Math.round(
    roleMatch.score * 0.32
    + skills.score * 0.32
    + experience.score * 0.18
    + projects.score * 0.1
    + certs.score * 0.04
    + education.score * 0.04
  );

  const preferredMatched = (skills.rows || [])
    .filter((row) => row.importance === "preferred" && row.found)
    .map((row) => row.skill);
  const preferredMissing = (skills.rows || [])
    .filter((row) => row.importance === "preferred" && !row.found)
    .map((row) => row.skill);

  const matchedSkills = [...(skills.matchedSkills || []), ...preferredMatched];
  const missingSkills = [...(skills.missingSkills || []), ...preferredMissing].slice(0, 5);

  return {
    roleId: role.id,
    roleTitle,
    family: role.family,
    matchScore,
    matchBand: guidanceBand(matchScore),
    matchedSkills,
    missingSkills,
    whyThisRole: whyThisRole(roleTitle, matchedSkills, missingSkills, role.responsibilities),
    suggestedNextSteps: suggestedNextSteps(role, missingSkills),
  };
}

function recommendRoles({ resume } = {}) {
  const data = resume && typeof resume === "object" ? resume : {};
  if (!hasAnalyzableContent(data)) {
    return {
      recommendations: [],
      insufficientContent: true,
      message: "Add skills, experience, or a project so we can recommend roles that fit your resume.",
      overallReadiness: {
        family: null,
        familyLabel: null,
        topRoleTitle: null,
        headline: "Add more to your resume first.",
      },
    };
  }

  const ranked = ROLES
    .map((role) => scoreRole(data, role))
    .sort((a, b) => b.matchScore - a.matchScore || a.roleTitle.localeCompare(b.roleTitle));

  const recommendations = ranked.slice(0, 5);
  const top = recommendations[0];
  const familyCounts = {};
  for (const item of recommendations) {
    familyCounts[item.family] = (familyCounts[item.family] || 0) + 1;
  }
  const bestFamily = Object.keys(familyCounts).sort((a, b) => {
    if (familyCounts[b] !== familyCounts[a]) return familyCounts[b] - familyCounts[a];
    if (a === top.family) return -1;
    if (b === top.family) return 1;
    return 0;
  })[0] || top.family;
  const familyLabel = FAMILY_LABELS[bestFamily] || (ROLE_FAMILIES[bestFamily] ? bestFamily : "Professional");

  return {
    recommendations,
    overallReadiness: {
      family: bestFamily,
      familyLabel,
      topRoleTitle: top.roleTitle,
      headline: `You're best positioned for ${familyLabel}-family roles.`,
    },
  };
}

module.exports = {
  recommendRoles,
  guidanceBand,
  hasAnalyzableContent,
};
