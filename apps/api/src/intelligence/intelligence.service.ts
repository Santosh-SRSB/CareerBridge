import { Injectable } from '@nestjs/common';
import {
  SKILL_ASSESSMENT_MAX_QUESTIONS,
  SKILL_ASSESSMENT_RECORDED_COUNT,
  SKILL_ASSESSMENT_TYPED_COUNT,
  type InterviewFeedback,
  type JobMatch,
  type ResumeAnalysis,
  type ResumeContent,
  type SkillAssessmentFeedback,
} from '@careerbridge/shared';

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

  skillAssessmentQuestions(skills: string[], _resumeScore: number) {
    const picked = padSkillKeys(pickSkillKeys(skills), SKILL_ASSESSMENT_TYPED_COUNT);
    const questions: StoredSkillQuestion[] = [];
    const usedPrompts = new Set<string>();
    for (const skill of picked.slice(0, SKILL_ASSESSMENT_TYPED_COUNT)) {
      const item = pickObjectiveQuestion(skill, usedPrompts);
      usedPrompts.add(item.prompt);
      questions.push({
        kind: 'MCQ',
        prompt: item.prompt,
        skill: prettySkill(skill),
        options: item.options,
        correctIndex: item.correctIndex,
      });
    }
    for (const skill of padSkillKeys(picked, SKILL_ASSESSMENT_RECORDED_COUNT).slice(0, SKILL_ASSESSMENT_RECORDED_COUNT)) {
      questions.push({
        kind: 'SPOKEN',
        prompt: SPOKEN_PROMPTS[skill] || `Record your answer: how you used ${prettySkill(skill)} at work, college, or in a project.`,
        skill: prettySkill(skill),
        options: [],
      });
    }
    return questions.slice(0, SKILL_ASSESSMENT_MAX_QUESTIONS);
  }

  scoreSpokenClip(input: {
    text?: string;
    hasVideo: boolean;
    hasAudio: boolean;
    hasVoice: boolean;
    durationMs: number;
    byteLength: number;
  }) {
    if (!input.hasVideo || !input.hasAudio || !input.hasVoice || input.durationMs < 8000 || input.byteLength < 40_000) {
      return 0;
    }
    return scoreSpokenAnswer(input.text || '', true, input.durationMs, true);
  }

  scoreSkillAssessment(questions: StoredSkillQuestion[], answers: StoredSkillAnswer[]): SkillAssessmentFeedback {
    const results = questions.map((item, index) => {
      const answer = answers[index];
      const kind = normalizeQuestionKind(item);
      if (kind === 'MCQ') {
        return {
          prompt: item.prompt,
          skill: item.skill,
          kind: 'MCQ' as const,
          correct: Boolean(answer) && answer.selectedIndex === item.correctIndex,
        };
      }
      if (kind === 'SPOKEN') {
        const spokenScore =
          typeof answer?.score === 'number'
            ? answer.score
            : scoreSpokenAnswer(
                answer?.text || '',
                Boolean(answer?.hasAudio),
                answer?.durationMs || 0,
                Boolean(answer?.hasVoice),
              );
        return {
          prompt: item.prompt,
          skill: item.skill,
          kind: 'SPOKEN' as const,
          correct: spokenScore >= 60,
        };
      }
      if (kind === 'TYPED' && typeof answer?.selectedIndex !== 'number') {
        return {
          prompt: item.prompt,
          skill: item.skill,
          kind: 'TYPED' as const,
          correct: scoreTypedAnswer(answer?.text || '') >= 60,
        };
      }
      return {
        prompt: item.prompt,
        skill: item.skill,
        kind: 'MCQ' as const,
        correct: Boolean(answer) && answer.selectedIndex === item.correctIndex,
      };
    });
    const correct = results.filter((item) => item.correct).length;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    const strongSkills = [...new Set(results.filter((item) => item.correct).map((item) => item.skill))];
    const weakSkills = [...new Set(results.filter((item) => !item.correct).map((item) => item.skill))];
    return {
      score,
      correct,
      total: questions.length,
      strengths: strongSkills.length
        ? strongSkills.map((skill) => `You did well on ${skill}.`)
        : ['No strong answers this round. Tick the best option and speak clearly next time.'],
      improvements: weakSkills.length
        ? weakSkills.map((skill) => `Practise ${skill}. Tick the best option, and speak clearly on camera.`)
        : ['Keep practising so these answers stay sharp.'],
      results,
    };
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

export type StoredSkillQuestion = {
  kind: 'MCQ' | 'TYPED' | 'SPOKEN';
  prompt: string;
  skill: string;
  options: string[];
  correctIndex?: number;
};

export type StoredSkillAnswer = {
  selectedIndex?: number;
  text?: string;
  score?: number;
  hasAudio?: boolean;
  hasVoice?: boolean;
  durationMs?: number;
};

const TYPED_PROMPTS: Record<string, string> = {
  communication: 'Type one example of how you explained something clearly at work, college, or home.',
  'customer service': 'Type how you would help an angry customer who waited too long.',
  'ms excel': 'Type how you have used Excel, even in studies or internships.',
  sales: 'Type how you would convince someone to try a product they are unsure about.',
  'data entry': 'Type how you keep names and numbers accurate when entering data.',
  reactjs: 'Type how you would explain a React component to a teammate.',
  nodejs: 'Type how you would check an API that is returning an error.',
  'problem solving': 'Type a problem you fixed, and the first step you took.',
  teamwork: 'Type how you handled a teammate who missed a deadline.',
  english: 'Type a short professional message to a customer about a delay.',
  'cash handling': 'Type what you would do if the till amount did not match.',
  'ms word': 'Type how you would make a clean one-page document for a manager.',
};

const SPOKEN_PROMPTS: Record<string, string> = {
  communication: 'Record your answer: one example of how you explained something clearly at work, college, or home.',
  'customer service': 'Record your answer: how you would help an angry customer who waited too long.',
  'ms excel': 'Record your answer: how you have used Excel, even in studies or internships.',
  sales: 'Record your answer: how you would convince someone to try a product they are unsure about.',
  'data entry': 'Record your answer: how you keep names and numbers accurate when entering data.',
  reactjs: 'Record your answer: how you would explain a React component to a teammate.',
  nodejs: 'Record your answer: how you would check an API that is returning an error.',
  'problem solving': 'Record your answer: a problem you fixed, and the first step you took.',
  teamwork: 'Record your answer: how you handled a teammate who missed a deadline.',
  english: 'Record your answer: a short professional message to a customer about a delay.',
  'cash handling': 'Record your answer: what you would do if the till amount did not match.',
  'ms word': 'Record your answer: how you would make a clean one-page document for a manager.',
};

const SKILL_QUESTION_BANK: Record<string, Array<Omit<StoredSkillQuestion, 'skill' | 'kind'>>> = {
  communication: [
    {
      prompt: 'A teammate did not understand your message. What should you do first?',
      options: ['Repeat the same words louder', 'Ask what was unclear, then explain in simpler words', 'Ignore it and continue', 'Send the message to your manager'],
      correctIndex: 1,
    },
    {
      prompt: 'Which answer is clearest in an interview?',
      options: ['I am good at many things', 'I handled billing queries for 20 customers a day', 'I can do anything you need', 'I will learn later'],
      correctIndex: 1,
    },
  ],
  'customer service': [
    {
      prompt: 'A customer is angry about a delay. What is the best first step?',
      options: ['Blame another team', 'Listen, apologise, then share what you can do', 'Ask them to call later', 'Offer a discount immediately'],
      correctIndex: 1,
    },
    {
      prompt: 'Two customers need help at the same time. What should you do?',
      options: ['Help only the louder customer', 'Acknowledge both, finish the first quickly, then help the second', 'Leave both waiting', 'Ask both to come tomorrow'],
      correctIndex: 1,
    },
  ],
  'ms excel': [
    {
      prompt: 'In Excel, which feature is best for totals of a number column?',
      options: ['SUM', 'COPY', 'WRAP TEXT', 'MERGE'],
      correctIndex: 0,
    },
    {
      prompt: 'A manager asks for a clean list of unique city names. What should you use?',
      options: ['Remove Duplicates or UNIQUE', 'Bold the header', 'Increase font size', 'Print the sheet'],
      correctIndex: 0,
    },
  ],
  sales: [
    {
      prompt: 'A customer is unsure about buying. What should you do?',
      options: ['Force them to decide now', 'Ask what they need, then match a benefit to that need', 'Drop the price first', 'Walk away'],
      correctIndex: 1,
    },
    {
      prompt: 'What is the most useful thing to note after a sales call?',
      options: ['The customer’s favourite colour', 'Next step, objection, and follow-up date', 'Your lunch plan', 'The weather'],
      correctIndex: 1,
    },
  ],
  'data entry': [
    {
      prompt: 'You notice two spellings of the same name in a list. What should you do?',
      options: ['Leave both as they are', 'Check the source, then keep one consistent spelling', 'Delete the whole row', 'Add a third spelling'],
      correctIndex: 1,
    },
    {
      prompt: 'What reduces errors in data entry the most?',
      options: ['Typing as fast as possible', 'Checking a sample of rows against the original document', 'Using colourful fonts', 'Skipping empty fields'],
      correctIndex: 1,
    },
  ],
  reactjs: [
    {
      prompt: 'In React, why do we use state?',
      options: ['To store data that can change and update the screen', 'To replace HTML', 'To hide CSS', 'To stop the app from running'],
      correctIndex: 0,
    },
    {
      prompt: 'What should you do if a React page is blank after a change?',
      options: ['Ignore it', 'Check the console error, then fix the component', 'Delete node_modules first', 'Change the laptop'],
      correctIndex: 1,
    },
  ],
  nodejs: [
    {
      prompt: 'What is Node.js mainly used for?',
      options: ['Running JavaScript on the server', 'Designing logos', 'Editing videos', 'Sending SMS only'],
      correctIndex: 0,
    },
    {
      prompt: 'An API returns 400. What does that usually mean?',
      options: ['The server is down', 'The request data is invalid', 'Login succeeded', 'The file is too large every time'],
      correctIndex: 1,
    },
  ],
  'problem solving': [
    {
      prompt: 'A process is slow every afternoon. What should you do first?',
      options: ['Change everything at once', 'Find when it started, collect facts, then try one fix', 'Blame a teammate', 'Wait a month'],
      correctIndex: 1,
    },
  ],
  teamwork: [
    {
      prompt: 'A teammate missed their part of a task. What should you do?',
      options: ['Complain in a group chat', 'Check in privately, offer help, then tell the manager if it still blocks work', 'Do nothing', 'Cancel the project'],
      correctIndex: 1,
    },
  ],
  english: [
    {
      prompt: 'Which sentence is best for a customer email?',
      options: ['Your order will be delivered by Friday.', 'Order coming maybe soon.', 'We don’t know anything.', 'Call someone else.'],
      correctIndex: 0,
    },
  ],
  'cash handling': [
    {
      prompt: 'The till is short at the end of your shift. What should you do?',
      options: ['Ignore it', 'Count again, record the difference, and tell your supervisor', 'Take money from the next shift', 'Ask a customer to wait'],
      correctIndex: 1,
    },
  ],
  'ms word': [
    {
      prompt: 'You need the same heading style on every page of a document. What should you use?',
      options: ['Styles / Heading', 'All caps typing', 'A screenshot', 'Page colour'],
      correctIndex: 0,
    },
  ],
};

function scoreTypedAnswer(text: string) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean).length;
  const hasExample = /\b(for example|once|when i|because|we |customer)\b/.test(text.toLowerCase());
  let score = 0;
  if (words >= 12) score += 25;
  if (words >= 24) score += 20;
  if (words >= 40) score += 15;
  if (hasExample) score += 20;
  if (words < 12) return 0;
  return clamp(score);
}

function scoreSpokenAnswer(text: string, hasAudio: boolean, durationMs: number, hasVoice: boolean) {
  if (!hasAudio || !hasVoice || durationMs < 8000) return 0;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean).length;
  const hasExample = /\b(for example|once|when i|because|we |customer)\b/.test(text.toLowerCase());
  let score = 62;
  if (words >= 8) score += 12;
  if (words >= 20) score += 10;
  if (hasExample) score += 10;
  return clamp(score);
}

function prettySkill(value: string) {
  if (value === 'ms excel') return 'MS Excel';
  if (value === 'ms word') return 'MS Word';
  if (value === 'reactjs') return 'React';
  if (value === 'nodejs') return 'Node.js';
  return titleCase(value);
}

function pickObjectiveQuestion(skill: string, usedPrompts: Set<string>) {
  const bank = SKILL_QUESTION_BANK[skill] || [];
  const unused = bank.find((item) => item.prompt && !usedPrompts.has(item.prompt));
  const fallback = SKILL_QUESTION_BANK.communication[0];
  const item = unused || bank[0] || fallback;
  return {
    prompt: item.prompt,
    options: item.options,
    correctIndex: item.correctIndex ?? 0,
  };
}

function padSkillKeys(skills: string[], count: number) {
  const extras = ['communication', 'customer service', 'problem solving', 'teamwork', 'english'];
  const unique = [...skills];
  for (const extra of extras) {
    if (unique.length >= count) break;
    if (!unique.includes(extra)) unique.push(extra);
  }
  while (unique.length < count) unique.push('communication');
  return unique.slice(0, count);
}

function normalizeQuestionKind(item: StoredSkillQuestion): 'MCQ' | 'TYPED' | 'SPOKEN' {
  if (item.kind === 'TYPED' || item.kind === 'SPOKEN' || item.kind === 'MCQ') return item.kind;
  return item.options.length ? 'MCQ' : 'TYPED';
}

function pickSkillKeys(skills: string[]) {
  const keys = skills
    .map((item) => item.trim().toLowerCase())
    .map((item) => {
      if (!item) return '';
      if (item.includes('excel')) return 'ms excel';
      if (item.includes('word') && !item.includes('password')) return 'ms word';
      if (item.includes('react')) return 'reactjs';
      if (item.includes('node')) return 'nodejs';
      if (item.includes('customer')) return 'customer service';
      if (item.includes('communicat')) return 'communication';
      if (item.includes('sales')) return 'sales';
      if (item.includes('data')) return 'data entry';
      if (item.includes('problem')) return 'problem solving';
      if (item.includes('team')) return 'teamwork';
      if (item.includes('english')) return 'english';
      if (item.includes('cash')) return 'cash handling';
      return item.replace(/[^a-z0-9 +.#]/g, ' ').replace(/\s+/g, ' ').trim();
    })
    .filter((item) => item.length >= 2);
  const unique = [...new Set(keys)];
  if (!unique.length) return ['communication', 'customer service'];
  if (unique.length === 1) return [...unique, 'communication'];
  return unique.slice(0, 3);
}

export function skillsFromResumeText(text: string) {
  const lower = ` ${text.toLowerCase()} `;
  const catalog = [
    ...Object.keys(TYPED_PROMPTS),
    'python',
    'java',
    'javascript',
    'typescript',
    'html',
    'css',
    'sql',
    'mysql',
    'mongodb',
    'aws',
    'azure',
    'git',
    'figma',
    'photoshop',
    'marketing',
    'accounting',
    'tally',
    'hr',
    'recruitment',
    'leadership',
    'powerpoint',
    'canva',
    'android',
    'flutter',
    'kotlin',
    'php',
    'laravel',
    'django',
    'spring',
    'excel',
    'word',
    'react',
    'node',
  ];
  const found: string[] = [];
  for (const skill of catalog) {
    const token = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(^|[^a-z])${token}([^a-z]|$)`, 'i').test(lower)) found.push(skill);
  }
  return [...new Set(found)].slice(0, 8);
}
