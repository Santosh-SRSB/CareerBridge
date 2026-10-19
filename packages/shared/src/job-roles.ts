import { MASTER_JOB_ROLES } from './job-categories-and-skills';

const BASE_JOB_ROLE_CATALOG: Record<string, string[]> = {
  IT: [
    'Full Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Software Developer',
    'Software Engineer',
    'Data Analyst',
    'DevOps Engineer',
    'QA Engineer',
    'Mobile App Developer',
    'React Developer',
    'Java Developer',
    'Python Developer',
  ],
  FINANCE: ['Accountant', 'Financial Analyst', 'Accounts Executive', 'Auditor', 'Tax Consultant', 'Finance Executive'],
  HR: ['HR Executive', 'Talent Acquisition', 'HR Generalist', 'People Operations', 'Recruiter'],
  SALES: ['Sales Executive', 'Business Development Executive', 'Account Manager', 'Retail Associate'],
  MARKETING: ['Marketing Executive', 'Digital Marketing Executive', 'Content Marketer', 'Brand Executive'],
  GENERAL: ['Customer Service Executive', 'Front Office Executive', 'Business Analyst', 'Operations Executive'],
};

function categorizeRole(role: string): keyof typeof BASE_JOB_ROLE_CATALOG {
  const blob = role.toLowerCase();
  if (
    /\b(software|developer|engineer|devops|sre|qa|sdet|test|data|ml|ai|cloud|cyber|security|architect|product manager|scrum|cto|it support|ui\/ux|ux designer|graphic designer)\b/.test(
      blob,
    )
  ) {
    return 'IT';
  }
  if (/\b(finance|account|payroll|cfo|procurement|tax|audit)\b/.test(blob)) return 'FINANCE';
  if (/\b(hr|human resource|talent|recruit|chro)\b/.test(blob)) return 'HR';
  if (/\b(sales|business development|account manager|customer success|customer support)\b/.test(blob)) {
    return 'SALES';
  }
  if (/\b(market|seo|content|brand|copywriter)\b/.test(blob)) return 'MARKETING';
  return 'GENERAL';
}

function mergeCatalog(): Record<string, string[]> {
  const out: Record<string, string[]> = {
    IT: [...BASE_JOB_ROLE_CATALOG.IT],
    FINANCE: [...BASE_JOB_ROLE_CATALOG.FINANCE],
    HR: [...BASE_JOB_ROLE_CATALOG.HR],
    SALES: [...BASE_JOB_ROLE_CATALOG.SALES],
    MARKETING: [...BASE_JOB_ROLE_CATALOG.MARKETING],
    GENERAL: [...BASE_JOB_ROLE_CATALOG.GENERAL],
  };
  const seen = new Set<string>();
  for (const list of Object.values(out)) {
    for (const role of list) seen.add(role.toLowerCase());
  }
  for (const role of MASTER_JOB_ROLES) {
    const key = role.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out[categorizeRole(role)].push(role);
  }
  return out;
}

export const JOB_ROLE_CATALOG: Record<string, string[]> = mergeCatalog();

export type JobRoleCategory = keyof typeof JOB_ROLE_CATALOG;

export type JobRolesResponse = {
  /** Curated catalogue grouped by category. */
  catalog: Record<string, string[]>;
  /** Distinct titles of currently published jobs, most common first. */
  fromJobs: string[];
};

export function detectRoleCategory(interests: string[]): JobRoleCategory {
  const blob = interests.join(' ').toLowerCase();
  if (/\b(it|software|developer|engineer|tech|data|qa|devops)\b/.test(blob)) return 'IT';
  if (/\b(finance|account|caf|tax|audit|banking)\b/.test(blob)) return 'FINANCE';
  if (/\b(hr|human resource|talent|recruit)\b/.test(blob)) return 'HR';
  if (/\b(sales|bdm|business development|retail)\b/.test(blob)) return 'SALES';
  if (/\b(market|digital|seo|content|brand)\b/.test(blob)) return 'MARKETING';
  return 'GENERAL';
}

/** Unique, trimmed role names in first-seen order (case-insensitive). */
export function uniqueRoles(roles: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of roles) {
    const role = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (!role) continue;
    const key = role.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(role);
  }
  return out;
}
