const { analyzeResume } = require("../services/resumeAnalyzer");
const { rewriteResume, numbersPreserved } = require("../services/resumeRewriter");
const { normalizeProjectUrl, projectTechnologies } = require("../services/projectUtils");

const RESUME = {
  fullName: "Priya Sharma",
  title: "Data Analyst",
  email: "priya.sharma@email.com",
  phone: "555-0100",
  location: "Bengaluru",
  linkedin: "linkedin.com/in/priyasharma",
  summary: "Hardworking graduate looking for opportunities.",
  skills: ["React", "Python", "SQL", "Power BI", "HTML", "CSS"],
  experience: [
    {
      company: "Retail Insights",
      role: "Data Analyst",
      startDate: "2022",
      current: true,
      bullets: ["Worked on Power BI dashboard.", "Worked with SQL."],
    },
  ],
  projects: [
    {
      name: "Sales Dashboard",
      description: "Created a sales dashboard.",
      link: "github.com/priya/sales-dashboard",
      technologies: ["Power BI", "SQL"],
      bullets: ["Built dashboards using Power BI."],
    },
    {
      name: "Legacy Project",
      description: "Created a reusable planning framework.",
    },
  ],
  education: [
    {
      degree: "B.Sc",
      fieldOfStudy: "Mathematics & Computer Science",
      institution: "State University",
      startDate: "2018",
      endDate: "2021",
    },
  ],
  certifications: [{ name: "Microsoft Power BI Data Analyst", issuer: "Microsoft", date: "2023" }],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  const urlOk = normalizeProjectUrl("github.com/username/project");
  assert(urlOk.ok && urlOk.href.startsWith("https://"), "URL without protocol should normalize");
  const urlBad = normalizeProjectUrl("javascript:alert(1)");
  assert(!urlBad.ok, "javascript URLs must be rejected");
  assert(projectTechnologies({ technology: "Power BI" }).join(",") === "Power BI", "Singular technology must convert to array");
  assert(projectTechnologies({ technologies: ["Power BI", "SQL", "", "Excel", "Python"] }).join(",") === "Power BI,SQL,Excel,Python", "Empty technologies must be ignored");
  assert(projectTechnologies({ tech: "React" }).join(",") === "React", "Legacy tech field must convert");

  const withBullets = analyzeResume({
    resume: RESUME,
    targetRole: "Data Analyst",
    templateId: "ats-minimal",
  });
  const legacy = analyzeResume({
    resume: { ...RESUME, projects: [{ name: "Legacy Project", description: "Created a reusable planning framework." }] },
    targetRole: "Data Analyst",
    templateId: "ats-minimal",
  });
  assert(withBullets.projectMatrix[0].urlProvided === true, "URL should be provided");
  assert(typeof withBullets.projectMatrix[0].bulletQuality === "number", "Bullet quality missing");
  assert(legacy.projectMatrix[0].urlProvided === false, "Legacy project has no URL");
  assert(legacy.projectMatrix[0].urlLabel === "Optional / Not provided", "Missing project URL must stay optional");
  assert(legacy.overallScore > 0, "Legacy project resume should still score");

  const multiTech = analyzeResume({
    resume: {
      ...RESUME,
      projects: [{
        title: "Sales Analytics Dashboard",
        description: "Developed an interactive dashboard for analyzing sales performance.",
        bulletPoints: ["Built interactive dashboards.", "Analyzed sales data.", "Created KPI visualizations."],
        technologies: ["Power BI", "SQL", "Excel", "Python"],
        url: "https://github.com/example/project",
      }],
      certifications: [{
        name: "Python Programming Certificate",
        issuer: "ABC Institute",
        date: "2025",
        url: "https://coursera.org/certificate",
      }],
    },
    targetRole: "Data Analyst",
    templateId: "ats-minimal",
  });
  assert(multiTech.projectMatrix[0].technologies.join(",") === "Power BI,SQL,Excel,Python", "ATS must read all project technologies");
  assert(multiTech.projectMatrix[0].urlProvided === true, "Project URL should be recognized");
  assert(multiTech.certificationMatrix[0].urlProvided === true, "Certificate URL should be recognized");
  assert(withBullets.certificationMatrix[0].urlProvided === false, "Missing certificate URL must stay optional");

  const singularTech = analyzeResume({
    resume: {
      ...RESUME,
      projects: [{ title: "Project A", technology: "React", description: "Built a React dashboard." }],
    },
    targetRole: "Frontend Developer",
    templateId: "ats-minimal",
  });
  assert(singularTech.projectMatrix[0].technologies.join(",") === "React", "Legacy technology string must be analyzed");

  const JD = "Requirements: SQL, Python, Power BI, Excel";
  const rewrite = rewriteResume({
    resume: RESUME,
    targetRole: "Data Analyst",
    jobDescription: JD,
    templateId: "ats-minimal",
  });
  assert(rewrite.rewrittenResume.fullName === RESUME.fullName, "Name changed");
  assert(rewrite.rewrittenResume.email === RESUME.email, "Email changed");
  assert(rewrite.rewrittenResume.experience[0].company === "Retail Insights", "Company invented/changed");
  assert(rewrite.rewrittenResume.experience[0].startDate === "2022", "Dates changed");
  assert(rewrite.rewrittenResume.certifications[0].name === "Microsoft Power BI Data Analyst", "Certification changed");
  assert(rewrite.rewrittenResume.projects[0].technologies.join(",") === "Power BI,SQL", "Rewrite removed project technologies");
  assert(String(rewrite.rewrittenResume.projects[0].url || rewrite.rewrittenResume.projects[0].link).includes("github.com/priya/sales-dashboard"), "Rewrite dropped project URL");
  assert(rewrite.rewrittenResume.certifications[0].url === "", "Empty certificate URL should remain allowed");
  assert(rewrite.rewrittenResume.skills.includes("React"), "Unrelated skill was removed");
  assert(rewrite.rewrittenResume.skills[0] !== "React", "Skills were not reordered for Data Analyst");
  assert(!/40%|improved reporting efficiency by/i.test(JSON.stringify(rewrite.rewrittenResume)), "Invented metric");
  assert(numbersPreserved("Created a dashboard.", "Created an interactive dashboard to improve presentation."), "false metric detection");
  assert(rewrite.estimatedScoreAfter === rewrite.after.overallScore, "After score not independently stored");
  assert(rewrite.rewrittenResume.summary.toLowerCase().includes("data analyst"), "Summary not role-specific");
  assert(Array.isArray(rewrite.changes) && rewrite.changes.length > 0, "Missing change list");

  const java = rewriteResume({
    resume: RESUME,
    targetRole: "Java Developer",
    templateId: "ats-minimal",
  });
  assert(java.estimatedScoreAfter < rewrite.estimatedScoreAfter, "Rewrite after-score is not role-aware");
  assert(!JSON.stringify(java.rewrittenResume).toLowerCase().includes("spring boot"), "Invented Spring Boot");

  const withGap = rewriteResume({
    resume: {
      ...RESUME,
      careerGaps: [{
        type: "Career Development Period",
        startMonth: "June",
        startYear: "2023",
        endMonth: "March",
        endYear: "2024",
        activities: ["Completed SQL certification."],
        skills: ["SQL"],
        certifications: ["SQL Certification"],
        projects: ["Practice SQL project"],
      }],
    },
    targetRole: "Data Analyst",
    templateId: "ats-minimal",
  });
  assert(withGap.rewrittenResume.careerGaps[0].type === "Career Development Period", "Rewrite removed career break type");
  assert(withGap.rewrittenResume.careerGaps[0].startYear === "2023", "Rewrite changed career break dates");
  assert(withGap.rewrittenResume.careerGaps[0].skills.includes("SQL"), "Rewrite dropped gap skills");
  assert(withGap.rewrittenResume.careerGaps[0].projects.includes("Practice SQL project"), "Rewrite dropped gap projects");
  assert(!/invented freelance|Google|Amazon/i.test(JSON.stringify(withGap.rewrittenResume.careerGaps)), "Rewrite invented gap employment");

  const withCertUrl = rewriteResume({
    resume: {
      ...RESUME,
      certifications: [{ name: "Microsoft Power BI Data Analyst", issuer: "Microsoft", date: "2023", url: "https://example.com/certificate" }],
    },
    targetRole: "Data Analyst",
    jobDescription: JD,
    templateId: "ats-minimal",
  });
  assert(withCertUrl.rewrittenResume.certifications[0].url === "https://example.com/certificate", "Rewrite dropped certificate URL");
  assert(withCertUrl.rewrittenResume.projects[0].technologies.includes("Power BI"), "Rewrite dropped technologies when improving wording");

  const before = analyzeResume({ resume: RESUME, targetRole: "Data Analyst", jobDescription: JD, templateId: "ats-minimal" });
  const after = analyzeResume({
    resume: rewrite.rewrittenResume,
    targetRole: "Data Analyst",
    jobDescription: JD,
    templateId: "ats-minimal",
  });
  assert(before.overallScore === rewrite.estimatedScoreBefore, "Before score was not recalculated from original");
  assert(after.overallScore === rewrite.estimatedScoreAfter, "After score was not recalculated from rewrite");

  console.log("URL normalize:", urlOk.href);
  console.log("Project matrix URL/bullets:", withBullets.projectMatrix[0].urlLabel, withBullets.projectMatrix[0].bulletQuality);
  console.log("Rewrite Data Analyst:", rewrite.estimatedScoreBefore, "->", rewrite.estimatedScoreAfter);
  console.log("Rewrite Java Developer after:", java.estimatedScoreAfter);
  console.log("Skill order:", rewrite.rewrittenResume.skills.join(", "));
  console.log("Summary:", rewrite.rewrittenResume.summary);
  console.log("Experience[0]:", rewrite.rewrittenResume.experience[0].bullets);
  console.log("All rewrite/project checks passed.");
}

run();
