const { generateQuestion, evaluateAnswer, summarizeSession, CATEGORY_ORDER } = require("../services/interviewEngine");
const { buildRoleProfile } = require("../services/roleKnowledge");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const failures = [];
const log = [];
const profile = buildRoleProfile("Data Analyst");

try {
  const asked = [];
  const questions = [];
  for (let i = 0; i < 5; i += 1) {
    const next = generateQuestion({
      roleProfile: profile,
      difficulty: "standard",
      askedCompetencies: asked,
      askedQuestions: questions.map((q) => q.question),
    });
    asked.push(next.competencyKey);
    questions.push(next);
  }
  assert(questions.length === 5, "Should generate 5 questions");
  assert(new Set(questions.map((q) => q.question)).size === 5, "Questions should not repeat immediately");
  assert(CATEGORY_ORDER.every((key) => asked.includes(key)), "First five questions should cover each competency category");

  const weak = evaluateAnswer({ question: questions[0].question, answer: "ok", roleProfile: profile });
  const strong = evaluateAnswer({
    question: questions[0].question,
    answer: "In my last role I used SQL and Power BI. The situation was delayed reporting. I wrote queries, built a dashboard, and the result was faster weekly insights for stakeholders because the metrics were easier to see.",
    roleProfile: profile,
  });
  assert(strong.score > weak.score, "A structured keyword-rich answer should score higher");
  assert(strong.feedback && strong.strengths.length && strong.improve.length <= 2, "Evaluation shape is incomplete");
  assert(Number.isInteger(strong.score), "Score should be a whole number");

  const summary = summarizeSession([
    { answer: "ok", evaluation: weak },
    { answer: "longer answer", evaluation: strong },
  ]);
  assert(summary.overallScore >= 0 && summary.overallBand, "Summary missing band");
  assert(summary.improvementPlan.length >= 2 && summary.improvementPlan.length <= 3, "Improvement plan should have 2-3 items");
  log.push(`Weak ${weak.score} / strong ${strong.score} / band ${summary.overallBand}`);
} catch (err) {
  failures.push(err.message);
}

console.log(log.join("\n") || "Interview engine checks");
if (failures.length) {
  console.error("\nFAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("All interview engine checks passed.");
