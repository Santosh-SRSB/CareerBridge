/** Curated technology & professional skills for searchable combobox */
export const TECHNOLOGY_SKILLS = [
  // Programming
  'Java', 'Python', 'JavaScript', 'TypeScript', 'C', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'R', 'Scala',
  // Web
  'HTML', 'CSS', 'React', 'ReactJS', 'Next.js', 'Angular', 'Vue.js', 'Node.js', 'NodeJS', 'Express.js', 'Django', 'Flask', 'Spring Boot', 'REST APIs', 'GraphQL',
  // Mobile
  'React Native', 'Flutter', 'Android', 'iOS',
  // Databases
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle', 'SQL Server', 'Firebase',
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Jenkins', 'Terraform', 'Linux', 'Nginx',
  // Data & AI
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Pandas', 'NumPy', 'Power BI', 'Tableau', 'Data Analysis', 'SQL',
  // Tools
  'Jira', 'Figma', 'Postman', 'VS Code', 'MS Excel', 'MS Word', 'PowerPoint', 'Tally',
  // Soft & business
  'Communication', 'Customer Service', 'Teamwork', 'Leadership', 'Problem Solving', 'Project Management', 'Agile', 'Scrum',
  // Languages (India)
  'English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi',
  // Other
  'Data Entry', 'Typing (English)', 'Point of Sale (POS)', 'Sales', 'Marketing', 'SEO', 'Content Writing',
] as const;

export const SUGGESTED_SKILL_POOL = [
  'Tally',
  'Typing (English)',
  'Tamil',
  'MS Excel',
  'Point of Sale (POS)',
  'Data Entry',
  'Customer Service',
  'Communication',
  'English',
];

export const DOMAIN_SKILL_CATALOG: Record<string, string[]> = {
  IT: [
    'Java',
    'Python',
    'JavaScript',
    'TypeScript',
    'SQL',
    'React',
    'Node.js',
    'HTML',
    'CSS',
    'Git',
    'AWS',
    'Docker',
    'MongoDB',
    'MySQL',
    'PostgreSQL',
    'REST APIs',
    'Data Analysis',
    'Machine Learning',
  ],
  Finance: [
    'MS Excel',
    'Tally',
    'Accounting',
    'GST',
    'Bookkeeping',
    'Financial Analysis',
    'Taxation',
    'SAP',
    'QuickBooks',
    'Auditing',
    'Budgeting',
    'Power BI',
  ],
  HR: [
    'Recruitment',
    'Talent Acquisition',
    'HR Operations',
    'Payroll',
    'Employee Engagement',
    'HRMS',
    'Interviewing',
    'Onboarding',
    'Performance Management',
    'MS Excel',
    'Communication',
  ],
  Healthcare: [
    'Patient Care',
    'Clinical Documentation',
    'Medical Coding',
    'Hospital Administration',
    'EMR',
    'Pharmacy',
    'Nursing',
    'First Aid',
  ],
  Retail: [
    'Customer Service',
    'Sales',
    'Point of Sale (POS)',
    'Inventory Management',
    'Merchandising',
    'Cash Handling',
    'Upselling',
  ],
  Operations: [
    'Operations Management',
    'Process Improvement',
    'Logistics',
    'Supply Chain',
    'Vendor Management',
    'MS Excel',
    'Project Management',
  ],
  Manufacturing: [
    'Quality Control',
    'Lean Manufacturing',
    'Six Sigma',
    'Production Planning',
    'Safety Compliance',
    'AutoCAD',
  ],
  Marketing: [
    'Digital Marketing',
    'SEO',
    'Content Writing',
    'Social Media',
    'Google Ads',
    'Canva',
    'Brand Management',
  ],
  Sales: [
    'Sales',
    'Negotiation',
    'CRM',
    'Lead Generation',
    'Customer Service',
    'Business Development',
  ],
  'Non-IT': [
    'Communication',
    'MS Excel',
    'MS Word',
    'PowerPoint',
    'Customer Service',
    'Data Entry',
    'Teamwork',
    'Leadership',
  ],
  Other: [
    'Communication',
    'MS Excel',
    'Problem Solving',
    'Teamwork',
    'Leadership',
    'Time Management',
  ],
};

export const ALL_SKILL_OPTIONS = Array.from(
  new Set([
    ...TECHNOLOGY_SKILLS,
    ...SUGGESTED_SKILL_POOL,
    ...Object.values(DOMAIN_SKILL_CATALOG).flat(),
  ]),
).sort((a, b) => a.localeCompare(b));

export function skillsForDomain(domain?: string | null): string[] {
  const key = (domain || '').trim();
  if (key && DOMAIN_SKILL_CATALOG[key]) {
    return DOMAIN_SKILL_CATALOG[key];
  }
  const lower = key.toLowerCase();
  if (/\b(it|software|tech|developer)\b/.test(lower)) return DOMAIN_SKILL_CATALOG.IT;
  if (/\b(finance|account|caf)\b/.test(lower)) return DOMAIN_SKILL_CATALOG.Finance;
  if (/\b(hr|human resource|talent)\b/.test(lower)) return DOMAIN_SKILL_CATALOG.HR;
  return ALL_SKILL_OPTIONS;
}
