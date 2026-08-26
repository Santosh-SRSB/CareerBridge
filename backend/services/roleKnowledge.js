// Role knowledge used when the user has not pasted a job description.
// Known roles are not a closed list — unknown titles fall back to a
// generated profile from the role name + occupational family.

function uniq(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const key = String(item || "").trim();
    if (!key) continue;
    const n = key.toLowerCase();
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(key);
  }
  return out;
}

const SKILL_ALIASES = {
  js: "JavaScript",
  javascript: "JavaScript",
  "java script": "JavaScript",
  reactjs: "React",
  "react.js": "React",
  react: "React",
  nodejs: "Node.js",
  "node.js": "Node.js",
  node: "Node.js",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  powerbi: "Power BI",
  "power bi": "Power BI",
  "ms excel": "Excel",
  "microsoft excel": "Excel",
  excel: "Excel",
  "advanced excel": "Excel",
  ts: "TypeScript",
  typescript: "TypeScript",
  html5: "HTML",
  html: "HTML",
  css3: "CSS",
  css: "CSS",
  "rest api": "REST APIs",
  "rest apis": "REST APIs",
  rest: "REST APIs",
  "restful apis": "REST APIs",
  "spring boot": "Spring Boot",
  springboot: "Spring Boot",
  spring: "Spring",
  "c#": "C#",
  csharp: "C#",
  "c++": "C++",
  cpp: "C++",
  golang: "Go",
  go: "Go",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  aws: "AWS",
  azure: "Azure",
  gcp: "Google Cloud",
  "google cloud": "Google Cloud",
  "google cloud platform": "Google Cloud",
  ml: "Machine Learning",
  "machine learning": "Machine Learning",
  "scikit-learn": "Scikit-learn",
  sklearn: "Scikit-learn",
  "scikit learn": "Scikit-learn",
  tf: "TensorFlow",
  tensorflow: "TensorFlow",
  pytorch: "PyTorch",
  "ms sql": "SQL Server",
  mssql: "SQL Server",
  "sql server": "SQL Server",
  mysql: "MySQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  "ci/cd": "CI/CD",
  cicd: "CI/CD",
  junit: "JUnit",
  maven: "Maven",
  gradle: "Gradle",
  pandas: "Pandas",
  numpy: "NumPy",
  tableau: "Tableau",
  "data visualization": "Data Visualization",
  visualisation: "Data Visualization",
  visualization: "Data Visualization",
  etl: "ETL",
  "power query": "Power Query",
  dax: "DAX",
  statistics: "Statistics",
  "ms office": "Microsoft Office",
  "microsoft office": "Microsoft Office",
  "ms word": "Microsoft Word",
  "ms powerpoint": "PowerPoint",
  powerpoint: "PowerPoint",
  "next.js": "Next.js",
  nextjs: "Next.js",
  "vue.js": "Vue",
  vuejs: "Vue",
  vue: "Vue",
  angularjs: "Angular",
  angular: "Angular",
  expressjs: "Express",
  express: "Express",
  django: "Django",
  flask: "Flask",
  fastapi: "FastAPI",
  "scrum": "Scrum",
  agile: "Agile",
  jira: "Jira",
  git: "Git",
  github: "Git",
  gitlab: "Git",
  docker: "Docker",
  linux: "Linux",
  python: "Python",
  java: "Java",
  sql: "SQL",
  r: "R",
  sas: "SAS",
  spark: "Apache Spark",
  "apache spark": "Apache Spark",
  hadoop: "Hadoop",
  nlp: "NLP",
  "natural language processing": "NLP",
  "deep learning": "Deep Learning",
  keras: "Keras",
  "looker studio": "Looker Studio",
  looker: "Looker",
  "google analytics": "Google Analytics",
  seo: "SEO",
  sem: "SEM",
  "hris": "HRIS",
  "ms project": "MS Project",
  pmp: "PMP",
  tsql: "SQL",
  "t-sql": "SQL",
};

const ROLE_FAMILIES = {
  data: {
    skills: ["SQL", "Excel", "Python", "Data Visualization", "Statistics", "Reporting", "Dashboards"],
    keywords: ["analysis", "insights", "dashboard", "metrics", "reporting", "data quality"],
    experienceAreas: ["data analysis", "reporting", "stakeholder communication"],
  },
  software: {
    skills: ["Git", "REST APIs", "SQL", "Testing", "Agile"],
    keywords: ["software", "development", "application", "debugging", "code"],
    experienceAreas: ["software development", "testing", "collaboration"],
  },
  frontend: {
    skills: ["HTML", "CSS", "JavaScript", "React", "Git", "Responsive Design"],
    keywords: ["ui", "frontend", "user interface", "accessibility", "browser"],
    experienceAreas: ["frontend development", "ui implementation"],
  },
  backend: {
    skills: ["REST APIs", "SQL", "Git", "Testing", "Linux"],
    keywords: ["api", "backend", "database", "server", "services"],
    experienceAreas: ["backend development", "api design"],
  },
  ml: {
    skills: ["Python", "Machine Learning", "Pandas", "SQL", "Statistics", "Scikit-learn"],
    keywords: ["model", "training", "prediction", "features", "evaluation"],
    experienceAreas: ["machine learning", "experimentation", "data preparation"],
  },
  management: {
    skills: ["Leadership", "Stakeholder Communication", "Planning", "Risk Management", "Agile"],
    keywords: ["delivery", "roadmap", "stakeholders", "budget", "timeline"],
    experienceAreas: ["project delivery", "cross-functional leadership"],
  },
  business: {
    skills: ["Excel", "Requirements Gathering", "Stakeholder Communication", "Process Improvement", "SQL"],
    keywords: ["requirements", "process", "stakeholders", "documentation", "analysis"],
    experienceAreas: ["business analysis", "requirements", "process mapping"],
  },
  people: {
    skills: ["Recruitment", "Communication", "Employee Relations", "HRIS", "Onboarding"],
    keywords: ["hiring", "employees", "policy", "onboarding", "engagement"],
    experienceAreas: ["human resources", "recruiting", "employee support"],
  },
  marketing: {
    skills: ["Digital Marketing", "SEO", "Content Writing", "Google Analytics", "Social Media"],
    keywords: ["campaigns", "brand", "audience", "conversion", "content"],
    experienceAreas: ["campaigns", "content", "analytics"],
  },
  finance: {
    skills: ["Accounting", "Excel", "Financial Reporting", "Reconciliation", "GST"],
    keywords: ["ledger", "audit", "balance sheet", "invoices", "compliance"],
    experienceAreas: ["accounting", "financial reporting", "audit support"],
  },
  quality: {
    skills: ["Test Cases", "Manual Testing", "Automation Testing", "Jira", "SQL"],
    keywords: ["qa", "defects", "regression", "quality", "test plan"],
    experienceAreas: ["quality assurance", "test execution"],
  },
  design: {
    skills: ["Figma", "Wireframing", "User Research", "Prototyping", "UI Design"],
    keywords: ["ux", "usability", "prototype", "user flows", "visual design"],
    experienceAreas: ["product design", "research", "prototyping"],
  },
  cloud: {
    skills: ["AWS", "Linux", "CI/CD", "Docker", "Networking"],
    keywords: ["cloud", "infrastructure", "deployment", "monitoring", "automation"],
    experienceAreas: ["cloud infrastructure", "automation"],
  },
};

const ROLES = [
  {
    id: "data-analyst",
    titles: ["data analyst", "data analytics", "analytics analyst", "reporting analyst", "bi analyst"],
    family: "data",
    requiredSkills: ["SQL", "Excel", "Python", "Power BI", "Data Visualization", "Statistics"],
    preferredSkills: ["Tableau", "ETL", "Pandas", "Power Query", "DAX", "R"],
    keywords: [
      "dashboard", "insights", "kpi", "reporting", "data cleaning", "data quality",
      "stakeholder", "metrics", "visualization", "analysis", "excel", "sql",
    ],
    responsibilities: [
      "analyze business data", "create dashboards", "write sql queries", "build reports", "communicate insights",
    ],
    certifications: ["Microsoft Power BI Data Analyst", "Google Data Analytics", "Tableau Desktop Specialist", "SQL Certification"],
    educationFields: ["statistics", "mathematics", "computer science", "economics", "information systems", "business analytics", "engineering"],
    experienceAreas: ["data analysis", "reporting", "business intelligence", "dashboard development"],
  },
  {
    id: "power-bi-developer",
    titles: ["power bi developer", "powerbi developer", "power bi analyst", "bi developer"],
    family: "data",
    requiredSkills: ["Power BI", "DAX", "Power Query", "SQL", "Data Visualization", "Excel"],
    preferredSkills: ["SSAS", "SSIS", "Azure", "Python", "Tableau", "Data Modeling"],
    keywords: ["dashboard", "dax", "power query", "dataset", "refresh", "row level security", "star schema"],
    responsibilities: ["build power bi reports", "model data", "write dax measures", "optimize refresh"],
    certifications: ["Microsoft Power BI Data Analyst", "Microsoft Certified: Fabric Analytics Engineer"],
    educationFields: ["computer science", "information systems", "statistics", "engineering"],
    experienceAreas: ["power bi development", "data modeling", "reporting"],
  },
  {
    id: "data-scientist",
    titles: ["data scientist", "applied scientist"],
    family: "ml",
    requiredSkills: ["Python", "Machine Learning", "SQL", "Statistics", "Pandas", "Scikit-learn"],
    preferredSkills: ["TensorFlow", "PyTorch", "NLP", "Deep Learning", "Apache Spark", "R", "Feature Engineering"],
    keywords: ["model", "prediction", "experiment", "hypothesis", "features", "evaluation", "classification", "regression"],
    responsibilities: ["build predictive models", "analyze datasets", "communicate findings", "feature engineering"],
    certifications: ["Google Data Scientist", "IBM Data Science", "AWS Machine Learning Specialty"],
    educationFields: ["computer science", "statistics", "mathematics", "data science", "engineering", "physics"],
    experienceAreas: ["machine learning", "statistical analysis", "experimentation"],
  },
  {
    id: "machine-learning-engineer",
    titles: ["machine learning engineer", "ml engineer", "mlops engineer", "ai engineer"],
    family: "ml",
    requiredSkills: ["Python", "Machine Learning", "Scikit-learn", "SQL", "Git", "Docker"],
    preferredSkills: ["TensorFlow", "PyTorch", "MLOps", "Kubernetes", "AWS", "Apache Spark", "FastAPI"],
    keywords: ["training", "inference", "pipeline", "deployment", "model serving", "feature store", "evaluation"],
    responsibilities: ["train models", "deploy ml systems", "build pipelines", "monitor model performance"],
    certifications: ["AWS Machine Learning Specialty", "TensorFlow Developer", "Google Professional ML Engineer"],
    educationFields: ["computer science", "machine learning", "engineering", "mathematics"],
    experienceAreas: ["model deployment", "ml pipelines", "production ml"],
  },
  {
    id: "software-developer",
    titles: ["software developer", "software engineer", "programmer", "application developer", "sde"],
    family: "software",
    requiredSkills: ["Git", "SQL", "REST APIs", "Testing", "JavaScript", "Problem Solving"],
    preferredSkills: ["Python", "Java", "TypeScript", "Docker", "Agile", "CI/CD", "Linux"],
    keywords: ["application", "debugging", "code review", "software", "implementation", "requirements"],
    responsibilities: ["develop software", "fix defects", "write tests", "collaborate with teammates"],
    certifications: ["AWS Certified Developer", "Microsoft Azure Developer"],
    educationFields: ["computer science", "information technology", "software engineering", "engineering", "mathematics"],
    experienceAreas: ["software development", "testing", "maintenance"],
  },
  {
    id: "java-developer",
    titles: ["java developer", "java engineer", "j2ee developer", "spring developer"],
    family: "backend",
    requiredSkills: ["Java", "Spring Boot", "Spring", "REST APIs", "Maven", "JUnit", "SQL"],
    preferredSkills: ["Hibernate", "Microservices", "Kafka", "Docker", "Kubernetes", "Gradle", "JPA"],
    keywords: ["spring", "jvm", "microservices", "api", "backend", "unit testing", "maven"],
    responsibilities: ["build java services", "write rest apis", "unit test with junit", "maintain spring applications"],
    certifications: ["Oracle Certified Professional Java", "Spring Professional"],
    educationFields: ["computer science", "information technology", "software engineering"],
    experienceAreas: ["java development", "api development", "backend services"],
  },
  {
    id: "python-developer",
    titles: ["python developer", "python engineer", "django developer", "flask developer"],
    family: "backend",
    requiredSkills: ["Python", "REST APIs", "SQL", "Git", "Testing", "Django"],
    preferredSkills: ["Flask", "FastAPI", "Pandas", "Docker", "Linux", "AWS", "Celery"],
    keywords: ["python", "backend", "scripting", "api", "automation", "django"],
    responsibilities: ["develop python applications", "build apis", "write tests", "integrate databases"],
    certifications: ["PCAP", "PCPP", "AWS Certified Developer"],
    educationFields: ["computer science", "information technology", "engineering"],
    experienceAreas: ["python development", "api development", "automation"],
  },
  {
    id: "frontend-developer",
    titles: ["frontend developer", "front end developer", "front-end developer", "ui developer", "web developer"],
    family: "frontend",
    requiredSkills: ["HTML", "CSS", "JavaScript", "React", "Git", "Responsive Design"],
    preferredSkills: ["TypeScript", "Next.js", "Redux", "Accessibility", "Jest", "Tailwind CSS", "Vue"],
    keywords: ["ui", "component", "browser", "responsive", "accessibility", "spa", "frontend"],
    responsibilities: ["build user interfaces", "implement responsive layouts", "consume apis", "improve ux"],
    certifications: ["Meta Front-End Developer", "Microsoft Front-End Developer"],
    educationFields: ["computer science", "web development", "design", "information technology"],
    experienceAreas: ["frontend development", "ui implementation", "web applications"],
  },
  {
    id: "backend-developer",
    titles: ["backend developer", "back end developer", "back-end developer", "api developer", "server side developer"],
    family: "backend",
    requiredSkills: ["REST APIs", "SQL", "Git", "Testing", "Linux"],
    preferredSkills: ["Java", "Python", "Node.js", "Docker", "Microservices", "Redis", "PostgreSQL"],
    keywords: ["api", "database", "server", "authentication", "scalability", "services"],
    responsibilities: ["design apis", "model data", "secure services", "optimize queries"],
    certifications: ["AWS Certified Developer", "Oracle Database SQL"],
    educationFields: ["computer science", "information technology", "software engineering"],
    experienceAreas: ["backend development", "databases", "api design"],
  },
  {
    id: "full-stack-developer",
    titles: ["full stack developer", "fullstack developer", "full-stack developer", "full stack engineer"],
    family: "software",
    requiredSkills: ["JavaScript", "HTML", "CSS", "REST APIs", "SQL", "Git", "React"],
    preferredSkills: ["Node.js", "TypeScript", "Docker", "MongoDB", "PostgreSQL", "Next.js", "Testing"],
    keywords: ["fullstack", "end to end", "frontend", "backend", "api", "database"],
    responsibilities: ["build frontend and backend", "integrate apis", "ship features end to end"],
    certifications: ["Meta Full-Stack Developer", "AWS Certified Developer"],
    educationFields: ["computer science", "information technology", "software engineering"],
    experienceAreas: ["full stack development", "web applications", "api integration"],
  },
  {
    id: "business-analyst",
    titles: ["business analyst", "ba", "functional analyst", "systems analyst"],
    family: "business",
    requiredSkills: ["Requirements Gathering", "Excel", "Stakeholder Communication", "Process Mapping", "Documentation"],
    preferredSkills: ["SQL", "Power BI", "Jira", "Agile", "UML", "User Stories"],
    keywords: ["requirements", "process", "gap analysis", "stakeholders", "user stories", "documentation"],
    responsibilities: ["gather requirements", "map processes", "write user stories", "liaise with stakeholders"],
    certifications: ["CBAP", "CCBA", "PMI-PBA"],
    educationFields: ["business", "information systems", "economics", "computer science", "management"],
    experienceAreas: ["business analysis", "requirements", "process improvement"],
  },
  {
    id: "project-manager",
    titles: ["project manager", "program manager", "it project manager", "delivery manager"],
    family: "management",
    requiredSkills: ["Project Management", "Stakeholder Communication", "Planning", "Risk Management", "Agile"],
    preferredSkills: ["Scrum", "Jira", "MS Project", "Budgeting", "PMP", "Leadership"],
    keywords: ["timeline", "scope", "budget", "risk", "delivery", "stakeholders", "milestone"],
    responsibilities: ["plan delivery", "manage stakeholders", "track risk", "report status"],
    certifications: ["PMP", "PRINCE2", "Certified Scrum Master"],
    educationFields: ["business", "management", "information systems", "engineering"],
    experienceAreas: ["project delivery", "stakeholder management", "planning"],
  },
  {
    id: "hr-executive",
    titles: ["hr executive", "human resources", "hr coordinator", "recruiter", "talent acquisition", "hr specialist"],
    family: "people",
    requiredSkills: ["Recruitment", "Communication", "Onboarding", "Employee Relations", "MS Office"],
    preferredSkills: ["HRIS", "Payroll", "Labour Law", "ATS", "Interviewing"],
    keywords: ["hiring", "onboarding", "policy", "engagement", "compliance", "interviews"],
    responsibilities: ["source candidates", "coordinate interviews", "support employees", "maintain hr records"],
    certifications: ["SHRM-CP", "PHR", "HRCI"],
    educationFields: ["human resources", "psychology", "business", "management"],
    experienceAreas: ["recruitment", "hr operations", "employee support"],
  },
  {
    id: "marketing-executive",
    titles: ["marketing executive", "digital marketing", "marketing specialist", "brand executive", "content marketer"],
    family: "marketing",
    requiredSkills: ["Digital Marketing", "SEO", "Content Writing", "Social Media", "Google Analytics"],
    preferredSkills: ["SEM", "Email Marketing", "Copywriting", "Canva", "Paid Ads", "CRM"],
    keywords: ["campaign", "brand", "leads", "conversion", "audience", "content", "seo"],
    responsibilities: ["run campaigns", "create content", "track analytics", "grow brand awareness"],
    certifications: ["Google Analytics", "Google Ads", "HubSpot Content Marketing"],
    educationFields: ["marketing", "communications", "business", "journalism"],
    experienceAreas: ["campaigns", "content marketing", "digital analytics"],
  },
  {
    id: "accountant",
    titles: ["accountant", "accounts executive", "staff accountant", "bookkeeper", "finance executive"],
    family: "finance",
    requiredSkills: ["Accounting", "Excel", "Financial Reporting", "Reconciliation", "Tally"],
    preferredSkills: ["GST", "SAP", "QuickBooks", "Taxation", "Audit"],
    keywords: ["ledger", "journal", "balance sheet", "invoices", "month end", "compliance"],
    responsibilities: ["maintain books", "reconcile accounts", "prepare reports", "support audits"],
    certifications: ["CPA", "CA", "ACCA", "CMA"],
    educationFields: ["accounting", "finance", "commerce", "business"],
    experienceAreas: ["accounting", "reporting", "reconciliation"],
  },
  {
    id: "devops-engineer",
    titles: ["devops engineer", "sre", "site reliability engineer", "platform engineer"],
    family: "cloud",
    requiredSkills: ["Linux", "CI/CD", "Docker", "Git", "AWS", "Networking"],
    preferredSkills: ["Kubernetes", "Terraform", "Python", "Prometheus", "Ansible"],
    keywords: ["pipeline", "infrastructure", "monitoring", "deployment", "automation", "reliability"],
    responsibilities: ["automate deployments", "maintain infrastructure", "monitor systems"],
    certifications: ["AWS SysOps", "CKA", "HashiCorp Terraform Associate"],
    educationFields: ["computer science", "information technology", "engineering"],
    experienceAreas: ["ci/cd", "cloud infrastructure", "automation"],
  },
  {
    id: "qa-engineer",
    titles: ["qa engineer", "quality analyst", "test engineer", "sdet", "qa tester"],
    family: "quality",
    requiredSkills: ["Test Cases", "Manual Testing", "Jira", "SQL", "Bug Tracking"],
    preferredSkills: ["Selenium", "Automation Testing", "API Testing", "Cypress", "Postman"],
    keywords: ["regression", "defects", "test plan", "qa", "coverage", "release"],
    responsibilities: ["write test cases", "log defects", "regression testing", "validate releases"],
    certifications: ["ISTQB"],
    educationFields: ["computer science", "information technology", "engineering"],
    experienceAreas: ["quality assurance", "test execution", "defect management"],
  },
  {
    id: "product-manager",
    titles: ["product manager", "product owner", "associate product manager"],
    family: "management",
    requiredSkills: ["Product Management", "Roadmapping", "User Stories", "Stakeholder Communication", "Prioritization"],
    preferredSkills: ["SQL", "A/B Testing", "Jira", "Analytics", "Wireframing"],
    keywords: ["roadmap", "discovery", "metrics", "user", "prioritization", "backlog"],
    responsibilities: ["define roadmap", "write stories", "align stakeholders", "measure outcomes"],
    certifications: ["Pragmatic Institute", "CSPO"],
    educationFields: ["business", "computer science", "engineering", "design"],
    experienceAreas: ["product discovery", "delivery", "analytics"],
  },
];

const TITLE_TOKEN_SKILLS = {
  python: ["Python"],
  java: ["Java", "Spring Boot", "Spring"],
  javascript: ["JavaScript"],
  react: ["React", "JavaScript", "HTML", "CSS"],
  angular: ["Angular", "TypeScript", "HTML", "CSS"],
  node: ["Node.js", "JavaScript"],
  "node.js": ["Node.js"],
  golang: ["Go"],
  go: ["Go"],
  rust: ["Rust"],
  kotlin: ["Kotlin"],
  swift: ["Swift"],
  php: ["PHP"],
  ruby: ["Ruby"],
  scala: ["Scala"],
  "c#": ["C#"],
  ".net": ["C#", ".NET"],
  "power bi": ["Power BI", "DAX", "Power Query"],
  powerbi: ["Power BI"],
  tableau: ["Tableau"],
  salesforce: ["Salesforce"],
  sap: ["SAP"],
  aws: ["AWS"],
  azure: ["Azure"],
  android: ["Android", "Kotlin"],
  ios: ["iOS", "Swift"],
  flutter: ["Flutter", "Dart"],
  "machine learning": ["Machine Learning", "Python"],
  ml: ["Machine Learning", "Python"],
  "data science": ["Python", "Machine Learning", "Statistics"],
  frontend: ["HTML", "CSS", "JavaScript"],
  backend: ["REST APIs", "SQL"],
  fullstack: ["JavaScript", "REST APIs", "SQL", "HTML", "CSS"],
  "full stack": ["JavaScript", "REST APIs", "SQL"],
  devops: ["CI/CD", "Docker", "Linux"],
  cloud: ["AWS", "Linux"],
  security: ["Security", "Linux"],
  blockchain: ["Blockchain"],
  excel: ["Excel"],
  sql: ["SQL"],
};

function normalizeKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[#]/g, "#")
    .replace(/[._/+\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalSkill(raw) {
  const original = String(raw || "").trim();
  if (!original) return "";
  const key = normalizeKey(original);
  if (SKILL_ALIASES[key]) return SKILL_ALIASES[key];
  const compact = key.replace(/\s+/g, "");
  if (SKILL_ALIASES[compact]) return SKILL_ALIASES[compact];
  return original.replace(/\s+/g, " ").trim();
}

function skillKey(raw) {
  return normalizeKey(canonicalSkill(raw)).replace(/\s+/g, " ");
}

function allKnownSkills() {
  const skills = [];
  for (const role of ROLES) {
    skills.push(...role.requiredSkills, ...role.preferredSkills, ...role.certifications);
  }
  for (const family of Object.values(ROLE_FAMILIES)) {
    skills.push(...family.skills);
  }
  skills.push(
    "HTML", "CSS", "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java",
    "SQL", "Excel", "Power BI", "Tableau", "Git", "Docker", "AWS", "Azure",
    "Machine Learning", "Pandas", "NumPy", "Statistics", "Spring Boot", "JUnit", "Maven"
  );
  return uniq(skills.map(canonicalSkill));
}

const KNOWN_SKILLS = allKnownSkills();

function detectFamily(roleName) {
  const n = normalizeKey(roleName);
  if (/\b(data scientist|machine learning|ml engineer|ai engineer)\b/.test(n)) return "ml";
  if (/\b(data|analytics|bi |business intelligence|power bi)\b/.test(n)) return "data";
  if (/\b(front end|frontend|ui developer|web developer)\b/.test(n)) return "frontend";
  if (/\b(back end|backend|api developer)\b/.test(n)) return "backend";
  if (/\b(full stack|fullstack)\b/.test(n)) return "software";
  if (/\b(devops|sre|platform|cloud|site reliability)\b/.test(n)) return "cloud";
  if (/\b(qa|quality|sdet|test engineer|tester)\b/.test(n)) return "quality";
  if (/\b(product manager|product owner)\b/.test(n)) return "management";
  if (/\b(project manager|program manager|delivery)\b/.test(n)) return "management";
  if (/\b(hr|human resource|recruiter|talent)\b/.test(n)) return "people";
  if (/\b(market|seo|brand|content)\b/.test(n)) return "marketing";
  if (/\b(account|finance|bookkeep|audit|tax)\b/.test(n)) return "finance";
  if (/\b(design|ux|ui\/ux|figma)\b/.test(n)) return "design";
  if (/\b(business analyst|functional analyst)\b/.test(n)) return "business";
  if (/\b(developer|engineer|programmer|software)\b/.test(n)) return "software";
  if (/\b(analyst)\b/.test(n)) return "data";
  if (/\b(manager)\b/.test(n)) return "management";
  return "software";
}

function extractTitleSkills(roleName) {
  const n = ` ${normalizeKey(roleName)} `;
  const found = [];
  const keys = Object.keys(TITLE_TOKEN_SKILLS).sort((a, b) => b.length - a.length);
  for (const token of keys) {
    if (n.includes(` ${token} `) || n.includes(token)) {
      found.push(...TITLE_TOKEN_SKILLS[token]);
    }
  }
  return uniq(found.map(canonicalSkill));
}

function findKnownRole(roleName) {
  const n = normalizeKey(roleName);
  if (!n) return null;
  for (const role of ROLES) {
    if (role.titles.some((t) => n === t || n.includes(t) || t.includes(n))) return role;
  }
  // token overlap fallback
  let best = null;
  let bestScore = 0;
  const tokens = new Set(n.split(" ").filter((t) => t.length > 2));
  for (const role of ROLES) {
    for (const title of role.titles) {
      const titleTokens = title.split(" ").filter((t) => t.length > 2);
      const overlap = titleTokens.filter((t) => tokens.has(t)).length;
      const score = overlap / Math.max(titleTokens.length, 1);
      if (score > bestScore) {
        bestScore = score;
        best = role;
      }
    }
  }
  return bestScore >= 0.66 ? best : null;
}

function buildRoleProfile(targetRole) {
  const label = String(targetRole || "").trim() || "Professional";
  const known = findKnownRole(label);
  const familyId = known ? known.family : detectFamily(label);
  const family = ROLE_FAMILIES[familyId] || ROLE_FAMILIES.software;
  const titleSkills = extractTitleSkills(label);

  if (known) {
    return {
      id: known.id,
      name: label,
      known: true,
      family: familyId,
      requiredSkills: uniq([...titleSkills, ...known.requiredSkills]),
      preferredSkills: uniq(known.preferredSkills.filter((s) => !titleSkills.includes(s))),
      keywords: uniq([...known.keywords, ...family.keywords, label]),
      responsibilities: known.responsibilities,
      certifications: known.certifications,
      educationFields: known.educationFields,
      experienceAreas: known.experienceAreas,
    };
  }

  return {
    id: `generic-${normalizeKey(label).replace(/\s+/g, "-") || "role"}`,
    name: label,
    known: false,
    family: familyId,
    requiredSkills: uniq([...titleSkills, ...family.skills]),
    preferredSkills: uniq(["Communication", "Problem Solving", "Stakeholder Communication"]),
    keywords: uniq([...family.keywords, ...label.toLowerCase().split(/\s+/).filter((t) => t.length > 2)]),
    responsibilities: family.experienceAreas.map((area) => `Contribute to ${area}`),
    certifications: [],
    educationFields: ["computer science", "business", "engineering", "related field"],
    experienceAreas: family.experienceAreas,
  };
}

module.exports = {
  SKILL_ALIASES,
  ROLES,
  ROLE_FAMILIES,
  KNOWN_SKILLS,
  canonicalSkill,
  skillKey,
  normalizeKey,
  buildRoleProfile,
  uniq,
};
