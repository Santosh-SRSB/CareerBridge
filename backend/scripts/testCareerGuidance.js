const { recommendRoles, hasAnalyzableContent } = require("../services/careerGuidance");

const DATA_ANALYST_RESUME = {
  fullName: "Priya Sharma",
  title: "Data Analyst",
  summary: "Data analyst with experience in SQL, Python, Power BI, Excel, and dashboard reporting.",
  skills: ["Python", "SQL", "Power BI", "Excel", "Data Visualization", "Statistics"],
  experience: [
    {
      company: "Retail Insights",
      role: "Data Analyst",
      startDate: "2022",
      current: true,
      bullets: ["Wrote SQL queries.", "Built Power BI dashboards."],
    },
  ],
  projects: [{ name: "Sales Dashboard", description: "Built a Power BI and SQL dashboard to track KPIs." }],
  education: [{ institution: "State University", degree: "B.Sc", fieldOfStudy: "Computer Science" }],
  certifications: [],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const failures = [];
const log = [];

try {
  assert(!hasAnalyzableContent({ skills: [], experience: [], projects: [] }), "Empty resume should not be analyzable");
  const thin = recommendRoles({ resume: { skills: [] } });
  assert(thin.insufficientContent === true, "Thin resume should flag insufficient content");
  assert((thin.recommendations || []).length === 0, "Thin resume should not invent role matches");
  assert(/add more to your resume/i.test(thin.message + thin.overallReadiness.headline), "Thin resume should ask the user to add content");

  const result = recommendRoles({ resume: DATA_ANALYST_RESUME });
  assert(Array.isArray(result.recommendations) && result.recommendations.length === 5, "Should return top 5 roles");
  assert(result.recommendations[0].matchScore >= result.recommendations[4].matchScore, "Roles should be ranked by score");
  assert(["Excellent Match", "Strong Match", "Good Match", "Potential Match"].includes(result.recommendations[0].matchBand), "Unknown match band");
  assert(result.recommendations.some((role) => /data/i.test(role.roleTitle) || role.roleId.includes("data")), "Data roles should appear for an analyst resume");
  assert(result.overallReadiness.headline, "Missing overall readiness headline");
  assert(result.recommendations[0].matchedSkills.length > 0, "Matched skills missing");
  assert(result.recommendations[0].suggestedNextSteps.length >= 2, "Next steps missing");
  log.push(`Top role: ${result.recommendations[0].roleTitle} (${result.recommendations[0].matchBand})`);
  log.push(`Headline: ${result.overallReadiness.headline}`);
} catch (err) {
  failures.push(err.message);
}

console.log(log.join("\n") || "Career guidance checks");
if (failures.length) {
  console.error("\nFAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("All career guidance checks passed.");
