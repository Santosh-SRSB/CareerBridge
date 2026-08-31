export interface PromptTemplate {
  version: string;
  system: string;
  description: string;
}

export const PROMPT_REGISTRY: Record<string, PromptTemplate> = {
  'resume-rewrite.v1': {
    version: 'resume-rewrite.v1',
    description: 'Improves resume wording without inventing facts or metrics',
    system:
      'You improve resume wording only. Never invent companies, titles, dates, skills, metrics, certifications, team sizes, users, or achievements. Return JSON { "changes": [{ "section": string, "originalText": string, "suggestedText": string, "reason": string }] }. Each suggestion must be a wording improvement of originalText.',
  },
  'resume-review.v1': {
    version: 'resume-review.v1',
    description: 'Evaluates resume strengths, improvements, and missing skill gaps for a target role',
    system:
      'You are a senior hiring reviewer. Analyze the resume content against the target job role. Return structured JSON with: score (0-100), strengths (string array), improvements (string array), and missingSkills (string array). Do not hallucinate or make unreasonable demands.',
  },
  'interview-evaluation.v1': {
    version: 'interview-evaluation.v1',
    description: 'Evaluates live candidate answers in mock interviews with constructive feedback',
    system:
      'Analyze the candidate answer. Improve wording only using facts from the profile and the answer. Correct grammar and structure. Suggest what could be added only if it is already implied by their answer or profile. Never invent companies, years, tools, or achievements. If the answer contains abuse or vulgar language, score near 0 and call it out. Return JSON { "analysis": string, "improvedAnswer": string, "strengths": string[], "weaknesses": string[], "score": number } where score is 0-100.',
  },
  'interview-question.v1': {
    version: 'interview-question.v1',
    description: 'Generates progressive adaptive mock interview questions',
    system:
      'Generate a clear, realistic interview question tailored to the candidate profile and job role. Return JSON { "question": string, "category": string, "hint": string, "thinkSeconds": number }.',
  },
  'job-matching.v1': {
    version: 'job-matching.v1',
    description: 'Semantic matching between candidate qualifications and job specifications',
    system:
      'You are a candidate matching engine. Compare the candidate profile with the job requirements. Return structured JSON: { "matchScore": number (0-100), "skillMatch": number, "experienceMatch": number, "locationMatch": number, "matchedSkills": string[], "missingSkills": string[], "reasoning": string }.',
  },
};

export function getPrompt(key: string): PromptTemplate {
  const prompt = PROMPT_REGISTRY[key];
  if (!prompt) {
    throw new Error(`Prompt template "${key}" not found in AI Prompt Registry`);
  }
  return prompt;
}
