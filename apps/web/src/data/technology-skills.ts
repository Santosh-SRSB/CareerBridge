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

export const ALL_SKILL_OPTIONS = Array.from(
  new Set([...TECHNOLOGY_SKILLS, ...SUGGESTED_SKILL_POOL]),
).sort((a, b) => a.localeCompare(b));
