import { Injectable } from '@nestjs/common';
import type { InterviewFeedback, JobMatch, ResumeAnalysis, ResumeContent } from '@careerbridge/shared';

export type MatchCandidate = {
  city: string | null;
  careerInterests: string[];
  skills: string[];
  hasExperience: string | null;
};

export type MatchJob = {
  city: string;
  category: string;
  requiredSkills: string[];
  experience: string | null;
};

const QUESTIONS: Record<string, string[]> = {
  HR: [
    'Tell me about yourself.',
    'Why do you want this job?',
    'What is your greatest strength?',
    'Tell me about a challenge you faced at work or in studies.',
    'Where do you see yourself in two years?',
    'Why should we hire you?',
    'Do you prefer working in a team or alone? Why?',
    'What questions do you have for us?',
  ],
  CUSTOMER_SERVICE: [
    'Tell me about a time when you handled a difficult customer.',
    'How do you stay calm under pressure?',
    'A customer is angry about a delay. What do you do?',
    'How would you explain a policy the customer does not like?',
    'Describe a time you went the extra mile for someone.',
    'How do you handle more than one customer at once?',
    'What does good service mean to you?',
    'How would you deal with a complaint about a colleague?',
  ],
  SITUATIONAL: [
    'A teammate is not doing their share of work. What do you do?',
    'You made a mistake that a customer noticed. How do you handle it?',
    'Your manager asks you to stay late on a busy day. How do you respond?',
    'Two customers need help at the same time. Who do you help first?',
    'You do not know the answer to a customer question. What next?',
    'A process at work is slowing people down. How would you improve it?',
    'You disagree with your supervisor. How do you raise it?',
    'Tell me how you would prepare for your first week in this role.',
  ],
};

@Injectable()
export class IntelligenceService {
  match(candidate: MatchCandidate, job: MatchJob): JobMatch {
    const required = job.requiredSkills.map((item) => item.toLowerCase());
    const skills = candidate.skills.map((item) => item.toLowerCase());
    const overlap = required.filter((skill) => skills.some((item) => item.includes(skill) || skill.includes(item)));
    const skillScore = required.length ? Math.round((overlap.length / required.length) * 40) : 20;
    const locationScore =
      candidate.city && job.city && candidate.city.toLowerCase() === job.city.toLowerCase() ? 25 : 8;
    const categoryScore = candidate.careerInterests.some(
      (item) => item.toLowerCase() === job.category.toLowerCase(),
    )
      ? 20
      : 8;
    const experienceScore =
      !job.experience || job.experience === 'NONE' || candidate.hasExperience
        ? 15
        : 6;
    const score = Math.min(100, skillScore + locationScore + categoryScore + experienceScore);
    const reasons = [
      overlap.length ? overlap.slice(0, 3).map(titleCase).join(', ') : '',
      locationScore === 25 ? 'Location' : '',
      categoryScore === 20 ? job.category : '',
    ].filter(Boolean);
    const gaps = required.filter((skill) => !overlap.includes(skill)).map(titleCase);
    return {
      score,
      skillScore,
      locationScore,
      categoryScore,
      experienceScore,
      reasons,
      gaps,
    };
  }

  analyzeResume(content: ResumeContent): ResumeAnalysis {
    const complete: string[] = [];
    const improve: string[] = [];
    if (content.fullName && content.phone) complete.push('Contact Information');
    else improve.push('Contact Information');
    if (content.education.length) complete.push('Education');
    else improve.push('Education');
    if (content.skills.length) complete.push('Skills');
    else improve.push('Skills');
    if (content.experiences.length) complete.push('Work Experience');
    else improve.push('Work Experience');
    if (content.summary && content.summary.length > 40) complete.push('Professional Summary');
    else improve.push('Professional Summary');
    const keywordHits = ['customer', 'communication', 'excel', 'sales'].filter((word) =>
      `${content.summary} ${content.skills.join(' ')}`.toLowerCase().includes(word),
    );
    if (keywordHits.length >= 2) complete.push('Keywords');
    else improve.push('Keywords');
    const score = Math.min(100, complete.length * 16 + content.skills.length * 2 + content.experiences.length * 4);
    const suggestions = [
      content.experiences.length
        ? 'Add measurable achievements to your experience, such as number of customers helped.'
        : 'Add internships, projects or volunteer experience so employers can see what you can do.',
      content.skills.includes('MS Excel') ? '' : 'Add MS Excel if you have used it, even in studies or internships.',
      content.summary.toLowerCase().includes('customer')
        ? ''
        : 'Highlight customer service or communication experience in your summary.',
    ]
      .filter(Boolean)
      .map((text, index) => ({ id: `s${index + 1}`, text }));
    return { score, complete, improve, suggestions };
  }

  buildResumeContent(input: {
    fullName: string;
    city: string | null;
    phone: string | null;
    language: string | null;
    skills: string[];
    education: ResumeContent['education'];
    experiences: ResumeContent['experiences'];
    targetJobTitle?: string;
  }): ResumeContent {
    const target = input.targetJobTitle || 'entry-level';
    const city = input.city || 'your city';
    const skillLine = input.skills.slice(0, 3).join(', ') || 'strong communication';
    return {
      fullName: input.fullName,
      city: input.city,
      phone: input.phone,
      summary: `${input.fullName} is looking for ${target} opportunities in ${city}. Skilled in ${skillLine} and ready to learn quickly on the job.`,
      skills: input.skills,
      education: input.education,
      experiences: input.experiences,
      languages: input.language ? [input.language] : [],
    };
  }

  questions(type: string): string[] {
    return QUESTIONS[type] || QUESTIONS.HR;
  }

  scoreInterview(answers: string[]): InterviewFeedback {
    const text = answers.join(' ').toLowerCase();
    const words = text.split(/\s+/).filter(Boolean).length;
    const hasExample = /example|once|when i|customer|because/.test(text);
    const communication = clamp(55 + Math.min(30, Math.floor(words / 12)));
    const structure = hasExample ? 78 : 62;
    const relevance = /customer|team|learn|service|job/.test(text) ? 80 : 64;
    const confidence = words > 80 ? 72 : 60;
    const score = Math.round((communication + structure + relevance + confidence) / 4);
    return {
      score,
      communication,
      structure,
      relevance,
      confidence,
      strengths: [
        'You addressed the question',
        relevance >= 70 ? 'Your answer was relevant' : 'You stayed on topic',
      ],
      improvements: [
        hasExample ? 'Structure your answer more clearly using a situation, action and result.' : 'Give a specific example from your experience.',
        'Keep practising so your answers feel more confident.',
      ],
    };
  }
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}
