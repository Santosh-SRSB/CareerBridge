import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve('C:/Users/ADMIN/Downloads/job_categories_and_skills_flat.json');
const outPath = path.resolve('packages/shared/src/job-categories-and-skills.ts');
const data = JSON.parse(fs.readFileSync(src, 'utf8'));

function uniq(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const s = String(raw).replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

const roles = uniq(data['job category'] || []);
const skills = uniq(data.skills || []);

const body = `/** Master job-role and skill lists for dropdowns (shared across API + web). */
export const MASTER_JOB_ROLES = ${JSON.stringify(roles, null, 2)} as const;

export const MASTER_SKILLS = ${JSON.stringify(skills, null, 2)} as const;
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(`Wrote ${roles.length} roles and ${skills.length} skills -> ${outPath}`);
