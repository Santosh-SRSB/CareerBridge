/* Bridge friend's CommonJS ATS engine into Nest. */
/* eslint-disable @typescript-eslint/no-require-imports */
const analyzer = require('./ats/resumeAnalyzer');
const rewriter = require('./ats/resumeRewriter');
const careerGuidance = require('./ats/careerGuidance');

export type RoleAtsInput = {
  targetRole: string;
  jobDescription?: string;
  templateId?: string;
  resume: Record<string, unknown>;
  analysis?: Record<string, unknown> | null;
};

export function analyzeRoleResume(input: RoleAtsInput) {
  return analyzer.analyzeResume({
    targetRole: input.targetRole,
    jobDescription: input.jobDescription || '',
    templateId: input.templateId || 'ats-minimal',
    resume: input.resume,
  });
}

export function rewriteRoleResume(input: RoleAtsInput) {
  return rewriter.rewriteResume({
    targetRole: input.targetRole,
    jobDescription: input.jobDescription || '',
    templateId: input.templateId || 'ats-minimal',
    resume: input.resume,
    analysis: input.analysis || null,
  });
}

export function recommendCareerRoles(resume: Record<string, unknown>) {
  return careerGuidance.recommendRoles({ resume });
}
