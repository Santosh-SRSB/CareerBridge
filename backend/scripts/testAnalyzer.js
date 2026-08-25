const { analyzeResume, calculateStarRating } = require("../services/resumeAnalyzer");

const DATA_ANALYST_RESUME = {
  fullName: "Priya Sharma",
  title: "Data Analyst",
  email: "priya.sharma@email.com",
  phone: "555-0100",
  location: "Bengaluru",
  linkedin: "linkedin.com/in/priyasharma",
  summary:
    "Data analyst with experience in SQL, Python, Power BI, Excel, statistics, and dashboard reporting. Comfortable cleaning datasets and communicating insights to stakeholders.",
  skills: ["Python", "SQL", "Power BI", "Machine Learning", "Pandas", "Excel", "Data Visualization", "Statistics"],
  experience: [
    {
      company: "Retail Insights",
      role: "Data Analyst",
      startDate: "2022",
      endDate: "",
      current: true,
      bullets: [
        "Developed Power BI dashboards that reduced monthly reporting time by 30%.",
        "Wrote SQL queries to analyze customer purchase patterns across 2 million rows.",
        "Used Python and Pandas for data preprocessing and quality checks.",
      ],
    },
  ],
  projects: [
    {
      name: "Sales Dashboard",
      description: "Built a customer-facing sales dashboard in Power BI and SQL to track KPIs and forecast demand.",
      link: "",
    },
    {
      name: "Churn Model",
      description: "Built a customer churn prediction model using Python and Pandas to identify at-risk accounts.",
      link: "",
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
  certifications: [
    { name: "Microsoft Power BI Data Analyst", issuer: "Microsoft", date: "2023" },
    { name: "SQL Certification", issuer: "Coursera", date: "2022" },
    { name: "Python Certification", issuer: "Coursera", date: "2022" },
  ],
};

const EMPTY_RESUME = {
  fullName: "",
  title: "",
  email: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
};

const ROLES = [
  "Data Analyst",
  "Software Developer",
  "Java Developer",
  "Python Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "Power BI Developer",
];

const JD = `We are looking for a Data Analyst with experience in SQL, Python, Power BI, Excel, data visualization, dashboards, statistics and data cleaning.

Responsibilities:
* Analyze business data
* Create dashboards
* Write SQL queries
* Build reports
* Communicate insights

Requirements:
* SQL
* Python
* Power BI
* Excel
* Statistics
* Data visualization

Preferred:
* Tableau
* AWS
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function run() {
  const failures = [];
  const log = [];

  try {
    const a = analyzeResume({ resume: DATA_ANALYST_RESUME, targetRole: "Data Analyst", templateId: "ats-professional" });
    const b = analyzeResume({ resume: DATA_ANALYST_RESUME, targetRole: "Data Analyst", templateId: "ats-professional" });
    assert(JSON.stringify(a) === JSON.stringify(b), "Analysis is not deterministic");
    log.push(`Deterministic: yes (${a.overallScore})`);
  } catch (err) {
    failures.push(err.message);
  }

  const byRole = {};
  for (const role of ROLES) {
    try {
      const result = analyzeResume({
        resume: DATA_ANALYST_RESUME,
        targetRole: role,
        templateId: "ats-minimal",
      });
      byRole[role] = result;
      log.push(
        `${role}: overall ${result.overallScore}, role ${result.roleMatch}, skills ${result.skillsMatch}, stars ${result.starRating}, missing skills: ${result.missingSkills.slice(0, 4).join(", ") || "none"}`
      );
      assert(result.overallScore >= 0 && result.overallScore <= 100, `${role} overall out of range`);
      assert(result.starRating === calculateStarRating(result.overallScore), `${role} star mismatch`);
      assert(Array.isArray(result.strengths), `${role} missing strengths`);
      assert(Array.isArray(result.recommendations), `${role} missing recommendations`);
    } catch (err) {
      failures.push(`${role}: ${err.message}`);
    }
  }

  try {
    const da = byRole["Data Analyst"];
    const java = byRole["Java Developer"];
    assert(da && java, "Missing role results");
    assert(da.overallScore > java.overallScore, `Data Analyst (${da.overallScore}) should beat Java Developer (${java.overallScore})`);
    assert(da.roleMatch > java.roleMatch, `Role match should drop for Java Developer (${da.roleMatch} vs ${java.roleMatch})`);
    assert(da.skillsMatch > java.skillsMatch, `Skills match should drop for Java Developer (${da.skillsMatch} vs ${java.skillsMatch})`);
    assert(java.missingSkills.some((s) => /java|spring/i.test(s)), `Java Developer should flag missing Java skills, got ${java.missingSkills.join(", ")}`);
    log.push(`Role-aware gap: Data Analyst ${da.overallScore} vs Java Developer ${java.overallScore} (delta ${da.overallScore - java.overallScore})`);
  } catch (err) {
    failures.push(err.message);
  }

  try {
    const withJd = analyzeResume({
      resume: DATA_ANALYST_RESUME,
      targetRole: "Data Analyst",
      jobDescription: JD,
      templateId: "ats-minimal",
    });
    const javaJd = analyzeResume({
      resume: DATA_ANALYST_RESUME,
      targetRole: "Data Analyst",
      jobDescription:
        "Requirements:\n* Java\n* Spring Boot\n* Maven\n* JUnit\n* REST APIs\nPreferred:\n* Kafka",
      templateId: "ats-minimal",
    });
    const withoutJd = byRole["Data Analyst"];
    log.push(
      `Job description: role-only ${withoutJd.overallScore} / analyst JD ${withJd.overallScore} / java JD ${javaJd.overallScore}`
    );
    assert(withJd.usedJobDescription === true, "JD flag should be true");
    assert(withoutJd.usedJobDescription === false, "JD flag should be false without description");
    assert(
      javaJd.overallScore < withJd.overallScore,
      `Java-focused JD should score lower than analyst JD (${javaJd.overallScore} vs ${withJd.overallScore})`
    );
    assert(javaJd.missingSkills.some((s) => /java|spring/i.test(s)), "Java JD should surface missing Java skills");
  } catch (err) {
    failures.push(err.message);
  }

  try {
    const empty = analyzeResume({ resume: EMPTY_RESUME, targetRole: "Data Analyst", templateId: "ats-minimal" });
    log.push(`Empty resume: ${empty.overallScore} / ${empty.interpretation}`);
    assert(empty.overallScore < byRole["Data Analyst"].overallScore, "Empty resume should score lower");
  } catch (err) {
    failures.push(`empty: ${err.message}`);
  }

  try {
    analyzeResume({ resume: DATA_ANALYST_RESUME, targetRole: "   " });
    failures.push("Empty role should throw");
  } catch (err) {
    log.push(`Empty role: ${err.message}`);
  }

  try {
    const longJd = "SQL Python ".repeat(20000);
    const result = analyzeResume({
      resume: DATA_ANALYST_RESUME,
      targetRole: "Data Analyst",
      jobDescription: longJd,
      templateId: "ats-classic",
    });
    log.push(`Long JD handled: ${result.overallScore}`);
  } catch (err) {
    failures.push(`long JD: ${err.message}`);
  }

  try {
    const dupes = analyzeResume({
      resume: { ...DATA_ANALYST_RESUME, skills: ["SQL", "sql", "Python", "python"] },
      targetRole: "Data Analyst",
      templateId: "photo-professional",
    });
    log.push(`Duplicate skills handled: ${dupes.skillsMatch}`);
  } catch (err) {
    failures.push(`dupes: ${err.message}`);
  }

  console.log(log.join("\n"));
  if (failures.length) {
    console.error("\nFAILURES:\n" + failures.join("\n"));
    process.exit(1);
  }
  console.log("\nAll analyzer checks passed.");
}

run();
