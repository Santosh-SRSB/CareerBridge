const { buildRoleProfile } = require("./roleKnowledge");
const { interpretScore } = require("./resumeAnalyzer");

const CATEGORY_ORDER = ["communication", "role-1", "problem-solving", "role-2", "behavioral"];

const QUESTION_BANK = {
  communication: [
    ({ roleTitle }) => `A teammate or stakeholder disagrees with your recommendation as a ${roleTitle}. How would you explain your thinking and still keep the conversation constructive?`,
    ({ roleTitle }) => `Describe a time you had to explain a technical or detailed idea to someone outside your field. How would you do that as a ${roleTitle}?`,
    ({ roleTitle }) => `How would you update a manager when a ${roleTitle} task is delayed, and what would you include in that update?`,
    ({ roleTitle }) => `Imagine two people want different outcomes from your ${roleTitle} work. How would you clarify the need and communicate a plan?`,
    ({ roleTitle }) => `What questions would you ask at the start of a new ${roleTitle} assignment so you understand the audience and success criteria?`,
  ],
  "problem-solving": [
    ({ roleTitle }) => `You are stuck on a ${roleTitle} problem with incomplete information. How would you investigate, decide, and move forward?`,
    ({ roleTitle }) => `Walk through how you would break a vague ${roleTitle} request into smaller steps you can actually complete.`,
    ({ roleTitle }) => `A solution you tried as a ${roleTitle} did not work. What would you check next, and how would you know you were improving?`,
    ({ roleTitle }) => `How would you prioritize if you had two ${roleTitle} tasks and only time for one? What trade-offs would you mention?`,
    ({ roleTitle }) => `Describe how you would find the root cause of a recurring issue in ${roleTitle} work rather than applying a quick patch.`,
  ],
  behavioral: [
    ({ roleTitle }) => `Tell me about a time you worked with others toward a shared goal. What was your part, and how would that look in a ${roleTitle} team?`,
    ({ roleTitle }) => `Describe a disagreement on a team. How did you handle it, and what would you do similarly as a ${roleTitle}?`,
    ({ roleTitle }) => `Share an example of receiving feedback. What did you change, and how would you apply that as a ${roleTitle}?`,
    ({ roleTitle }) => `How do you handle a deadline that is tighter than you expected in ${roleTitle} work?`,
    ({ roleTitle }) => `Tell me about a time you helped a teammate. What did you do, and what was the outcome?`,
  ],
};

function text(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return text(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["sql", "bi", "hr", "it", "qa", "ui", "ux", "ml"].includes(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ") || "this role";
}

function roleResponsibilityQuestions(roleTitle, responsibility, index) {
  const work = text(responsibility) || `core ${roleTitle} work`;
  const prompts = [
    `One key part of a ${roleTitle} role is to ${work}. Walk me through how you would approach that in a real situation.`,
    `Give a specific example — even from a project, class, or internship — that shows you can ${work} as a ${roleTitle}.`,
    `If you were asked to ${work} with limited time, what would you do first, and how would you check the result?`,
    `What would a good outcome look like after you ${work} in a ${roleTitle} role, and how would you explain it to others?`,
    `What mistakes should a ${roleTitle} avoid when they ${work}, and how would you catch those early?`,
  ];
  return prompts.map((prompt) => () => prompt);
}

function competencyLabel(category, roleProfile) {
  if (category === "communication") return "Communication";
  if (category === "problem-solving") return "Problem Solving";
  if (category === "behavioral") return "Behavioral / teamwork";
  if (category === "role-1") return (roleProfile.responsibilities && roleProfile.responsibilities[0]) || "Role-specific work";
  if (category === "role-2") {
    return (roleProfile.responsibilities && roleProfile.responsibilities[1])
      || (roleProfile.experienceAreas && roleProfile.experienceAreas[1])
      || "Role-specific work";
  }
  return category;
}

function generateQuestion({ roleProfile, difficulty = "standard", askedCompetencies = [], askedQuestions = [] }) {
  // TODO: replace with aiGateway.generate('interview-question', {...})
  const profile = roleProfile || buildRoleProfile("General Interview");
  const roleTitle = titleCase(profile.name || "this role");
  const used = new Set((askedCompetencies || []).map((item) => String(item)));
  const nextCategory = CATEGORY_ORDER.find((item) => !used.has(item))
    || CATEGORY_ORDER[(askedCompetencies || []).length % CATEGORY_ORDER.length];

  let bank = QUESTION_BANK[nextCategory];
  if (nextCategory === "role-1") {
    bank = roleResponsibilityQuestions(roleTitle, profile.responsibilities && profile.responsibilities[0], 0);
  } else if (nextCategory === "role-2") {
    bank = roleResponsibilityQuestions(
      roleTitle,
      (profile.responsibilities && profile.responsibilities[1]) || (profile.experienceAreas && profile.experienceAreas[1]),
      1
    );
  }

  const asked = new Set((askedQuestions || []).map((item) => text(item).toLowerCase()));
  const unused = (bank || []).map((fn, index) => {
    const prompt = typeof fn === "function" ? fn({ roleTitle, difficulty }) : String(fn);
    return { prompt, index };
  }).filter((item) => item.prompt && !asked.has(text(item.prompt).toLowerCase()));
  const chosen = unused[0] || {
    prompt: (bank && bank[0] && bank[0]({ roleTitle, difficulty })) || `Tell me how you would add value as a ${roleTitle}.`,
  };

  let question = chosen.prompt;
  if (difficulty === "beginner") {
    question = `For someone starting out: ${question}`;
  } else if (difficulty === "advanced") {
    question = `At a more senior bar: ${question} Include trade-offs in your answer.`;
  }

  return {
    competency: competencyLabel(nextCategory, profile),
    competencyKey: nextCategory,
    question,
  };
}

function keywordList(roleProfile) {
  const profile = roleProfile || {};
  return [
    ...(profile.requiredSkills || []),
    ...(profile.preferredSkills || []).slice(0, 6),
    ...(profile.keywords || []).slice(0, 10),
    ...(profile.responsibilities || []),
  ].map((item) => text(item).toLowerCase()).filter((item) => item.length > 2);
}

function evaluateAnswer({ question, answer, roleProfile }) {
  // TODO: replace with aiGateway.generate('interview-eval', {...})
  const body = text(answer);
  const words = body ? body.split(/\s+/).length : 0;
  const lower = body.toLowerCase();
  const cues = ["situation", "task", "action", "result", "because", "impact", "example", "learned", "first", "then"];
  const cueHits = cues.filter((cue) => lower.includes(cue)).length;
  const keywords = keywordList(roleProfile);
  const keywordHits = keywords.filter((keyword) => keyword.split(/\s+/).every((part) => part.length < 3 || lower.includes(part))).length;

  let score = 38;
  if (words >= 80) score += 24;
  else if (words >= 40) score += 16;
  else if (words >= 20) score += 8;
  else if (words < 8) score -= 12;
  score += Math.min(24, keywordHits * 4);
  score += Math.min(18, cueHits * 3);
  if (/\bi\b|\bwe\b/.test(lower)) score += 4;
  if (question && /trade-off/i.test(question.question || question) && /trade-?off|priority|compromise/i.test(lower)) {
    score += 6;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const strengths = [];
  const improve = [];
  if (words >= 40) strengths.push("You gave enough detail for the interviewer to follow your thinking.");
  if (keywordHits >= 2) strengths.push("You connected the answer to skills or work this role actually uses.");
  if (cueHits >= 2) strengths.push("You included a clear sequence (what happened, what you did, and what followed).");
  if (!strengths.length) strengths.push("You showed up and attempted the question — that is the right starting point.");

  if (words < 30) improve.push("Add a short real example with a beginning, what you did, and what changed.");
  if (keywordHits < 2) improve.push("Name one or two relevant tools or skills from your resume where they truly apply.");
  if (cueHits < 2) improve.push("Use a simple structure: situation, action, result.");
  if (improve.length > 2) improve.length = 2;
  if (strengths.length > 2) strengths.length = 2;

  let feedback;
  if (score >= 80) {
    feedback = "This is a strong, specific answer. Keep using real examples and the same clear structure in later questions.";
  } else if (score >= 65) {
    feedback = "Solid direction. Tighten the example so the action you took and the outcome are obvious in one or two sentences.";
  } else if (score >= 45) {
    feedback = "You started in the right place. Add a concrete example and mention relevant skills only if you have used them.";
  } else {
    feedback = "Keep going. Aim for a short story: the situation, what you did, and what you learned. One honest example is enough.";
  }

  return {
    score,
    feedback,
    strengths,
    improve,
  };
}

function summarizeSession(questions) {
  const answered = (questions || []).filter((q) => text(q.answer));
  const scores = answered.map((q) => Number(q.evaluation && q.evaluation.score) || 0);
  const overallScore = scores.length
    ? Math.round(scores.reduce((sum, n) => sum + n, 0) / scores.length)
    : 0;
  const interpreted = interpretScore(overallScore);
  const overallBand = ["Excellent Match", "Strong Match", "Good Match"].includes(interpreted.label)
    ? interpreted.label.replace(" Match", " performance")
    : overallScore >= 55 ? "Good performance" : "Developing performance";

  const strengths = [];
  const improve = [];
  for (const q of answered) {
    for (const item of (q.evaluation && q.evaluation.strengths) || []) {
      if (!strengths.includes(item)) strengths.push(item);
    }
    for (const item of (q.evaluation && q.evaluation.improve) || []) {
      if (!improve.includes(item)) improve.push(item);
    }
  }

  const improvementPlan = (improve.slice(0, 2).length ? improve.slice(0, 2) : [
    "Practice one STAR example from your resume before the next session.",
  ]).concat([
    "Re-run a short mock interview for the same role and compare how specific your examples are.",
  ]).slice(0, 3);

  return {
    overallScore,
    overallBand,
    strengths: strengths.slice(0, 4),
    improve: improve.slice(0, 4),
    improvementPlan,
    answeredCount: answered.length,
  };
}

module.exports = {
  generateQuestion,
  evaluateAnswer,
  summarizeSession,
  CATEGORY_ORDER,
};
