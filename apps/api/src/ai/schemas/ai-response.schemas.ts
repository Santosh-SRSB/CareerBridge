export interface ResumeReviewSuggestion {
  section: string;
  issue: string;
  currentText: string;
  improvedText: string;
}

export interface ResumeReviewResult {
  score: number;
  strengths: string[];
  improvements: string[];
  missingSkills: string[];
  suggestedSections?: Record<string, string>;
  /** Actionable Accept/Ignore edits for the resume Improve UI */
  suggestions?: ResumeReviewSuggestion[];
}

export interface ResumeRewriteChange {
  section: string;
  originalText: string;
  suggestedText: string;
  reason: string;
}

export interface ResumeRewriteResult {
  changes: ResumeRewriteChange[];
}

export interface InterviewEvaluationResult {
  analysis: string;
  improvedAnswer: string;
  strengths: string[];
  weaknesses: string[];
  score: number;
}

export interface InterviewQuestionResult {
  question: string;
  category: string;
  hint?: string;
  thinkSeconds?: number;
}

export interface JobMatchResult {
  matchScore: number;
  skillMatch: number;
  experienceMatch: number;
  locationMatch: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasoning: string;
}
