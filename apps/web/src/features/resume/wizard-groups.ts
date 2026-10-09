/**
 * The resume wizard keeps its eight internal steps (validation, ATS section edits and drafts key
 * off them) but presents them as four sections.
 */
export const WIZARD_GROUPS = [
  { label: 'Personal Details', steps: ['Personal'] },
  { label: 'Education & Experience', steps: ['Education', 'Experience'] },
  { label: 'Skills & Credentials', steps: ['Skills', 'Credentials'] },
  { label: 'Links & Review', steps: ['Links', 'Career Gap', 'Review'] },
] as const;

export const LAST_WIZARD_GROUP = WIZARD_GROUPS.length - 1;

export function wizardGroupIndex(step: string): number {
  const index = WIZARD_GROUPS.findIndex((group) => (group.steps as readonly string[]).includes(step));
  return index < 0 ? 0 : index;
}

/** Steps whose form cards render together for a section; Career Gap only when a gap exists. */
export function wizardGroupFormSteps(groupIndex: number, hasGap: boolean): string[] {
  const group = WIZARD_GROUPS[Math.min(Math.max(groupIndex, 0), LAST_WIZARD_GROUP)];
  return (group.steps as readonly string[]).filter(
    (step) => step !== 'Review' && (step !== 'Career Gap' || hasGap),
  );
}

export function wizardGroupFirstStep(groupIndex: number): string {
  return WIZARD_GROUPS[Math.min(Math.max(groupIndex, 0), LAST_WIZARD_GROUP)].steps[0];
}

export interface ProfileCompletionInput {
  fullName: string;
  email: string;
  phone: string;
  state: string;
  city: string;
  summary: string;
  linkedin: string;
  github: string;
  portfolio: string;
  preferredRole: string;
  preferredLocation: string;
  expectedSalary: string;
  education: unknown[];
  experience: unknown[];
  projects: unknown[];
  certifications: unknown[];
  achievements: unknown[];
  skills: unknown[];
  languages: unknown[];
}

/** Share of profile fields and sections that have real content, as a whole percentage. */
export function profileCompletionPercent(input: ProfileCompletionInput): number {
  const fields = [
    input.fullName,
    input.email,
    input.phone,
    input.state,
    input.city,
    input.summary,
    input.linkedin,
    input.github,
    input.portfolio,
    input.preferredRole,
    input.preferredLocation,
    input.expectedSalary,
  ];
  const lists = [
    input.education,
    input.experience,
    input.projects,
    input.certifications,
    input.achievements,
    input.skills,
    input.languages,
  ];
  const filled =
    fields.filter((value) => value.trim().length > 0).length + lists.filter((list) => list.length > 0).length;
  return Math.round((filled / (fields.length + lists.length)) * 100);
}
