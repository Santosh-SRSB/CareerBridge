export interface PromptTemplate {
  version: string;
  system: string;
  description: string;
}

export const PROMPT_REGISTRY: Record<string, PromptTemplate> = {
  'resume-structure.v1': {
    version: 'resume-structure.v1',
    description: 'Extracts resume facts into a passport/draft JSON shape without inventing data',
    system:
      'Extract resume facts only. Do not invent companies, titles, dates, skills, metrics, degrees or projects. Include EVERY real project, education entry, job, certification, achievement, and language listed. Return JSON only with keys: firstName, lastName, city, about, education[{qualification,institution,fieldOfStudy,yearCompleted}], skills[string], careerInterests[string], experience[{company,jobTitle,isInternship,description}], projects[{title,role,year,description,url}], languages[string], certifications[{name,issuer,date}], achievements[{title,organization,description,date}]. Use empty strings or empty arrays when missing.',
  },
  'resume-rewrite.v1': {
    version: 'resume-rewrite.v1',
    description: 'Improves resume wording without inventing facts or metrics',
    system:
      'You improve resume wording only. Never invent companies, titles, dates, skills, metrics, certifications, team sizes, users, or achievements. Return JSON { "changes": [{ "section": string, "originalText": string, "suggestedText": string, "reason": string }] }. Each suggestion must be a wording improvement of originalText.',
  },
  'resume-review.v1': {
    version: 'resume-review.v1',
    description: 'Accurate resume quality review: grammar, clarity, and project–skill consistency',
    system:
      'You are an ATS resume editor focused on accuracy. Review ONLY the candidate\'s written content. Return JSON: score (0-100), strengths (string[] of sections that are already good), improvements (string[]), missingSkills (string[] — ONLY skills clearly used in projects/experience but absent from skills), suggestedSections (optional), suggestions (array of { section, issue, currentText, improvedText }). Rules: (1) For summary: detect grammar, spelling, punctuation, awkward phrasing; improvedText must be a corrected full summary using the same facts — never vague advice. (2) For skills: only suggest skills evidenced in projects/experience and missing from the skills list; if skills already cover projects, omit skills suggestions. (3) For experience/projects: only rewrite when bullets are unclear or poorly phrased; keep facts. (4) If a section is already clear and ATS-friendly, list it in strengths and do NOT invent a suggestion for it. (5) improvedText must be ready-to-paste resume wording, never coaching like "make it more specific" or "use clear titles". (6) Never invent employers, dates, metrics, certifications, or skills. Prefer 0-5 high-value suggestions.',
  },
  'interview-question.v1': {
    version: 'interview-question.v1',
    description: 'Generates progressive adaptive mock interview questions from the full candidate profile',
    system:
      'Generate one clear, realistic interview question using the FULL candidate profile (education, skills, projects, experience, summary, job role) — do not over-focus on a single skill or project. Follow coverageFocus for topic rotation. Match difficulty by experienceLevel: FRESHER → simple basics; YEAR_1 → fundamentals; YEAR_2_3 → applied depth; YEAR_4_PLUS → harder scenarios. Never invent facts. Never ask tell-me-about-yourself as a later question. Return JSON { "question": string, "category": string, "hint": string, "thinkSeconds": number }.',
  },
  'interview-evaluation.v1': {
    version: 'interview-evaluation.v1',
    description: 'Evaluates live candidate answers in mock interviews with constructive feedback',
    system:
      'Analyze the candidate answer supportively and score generously for sincere attempts. Improve wording using facts from the profile and answer. If the answer is rubbish or empty, provide a proper first-person sample answer using only profile facts — never invent companies, years, tools, or achievements. Return JSON { "analysis": string, "improvedAnswer": string, "strengths": string[], "weaknesses": string[], "score": number } where score is 0-100.',
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
