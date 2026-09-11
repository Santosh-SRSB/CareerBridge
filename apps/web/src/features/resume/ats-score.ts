import { analyzeResumeContent, type ResumeContent } from '@careerbridge/shared';
import type { MasterResumeDocument } from './master-resume.types';
import { masterResumeToResumeContent } from './master-to-resume-content';

/**
 * Single source of truth for the ATS score shown on View Resume and Your Resumes.
 * Matches the backend `persistAnalysis` score (`analyzeResumeContent`).
 */
export function computeResumeAtsScore(
  content: ResumeContent,
  rawText = '',
): number {
  return analyzeResumeContent(content, rawText).score;
}

export function computeMasterResumeAtsScore(
  doc: MasterResumeDocument,
  rawText = '',
): number {
  return computeResumeAtsScore(masterResumeToResumeContent(doc), rawText);
}
