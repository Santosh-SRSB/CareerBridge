import { Injectable } from '@nestjs/common';
import type { InterviewReport, LiveInterviewQuestion, ResumeContent } from '@careerbridge/shared';
import { detectConduct } from './interview-conduct';
import { evaluableTextAnswer, isAudioPlaceholderAnswer } from './interview-answer.util';
import { AiGatewayService } from '../ai/ai-gateway.service';

export type InterviewProfile = {
  fullName: string;
  city?: string | null;
  skills: string[];
  education: string[];
  experiences: string[];
  summary: string;
  jobRole: string;
  focusStacks: string[];
  experienceYears: number;
  questionLimit?: number;
};

type BuiltQuestion = {
  text: string;
  category: string;
  snippet?: string | null;
  thinkSeconds?: number;
};

@Injectable()
export class InterviewAiService {
  constructor(private readonly aiGateway: AiGatewayService) {}

  firstQuestion(profile: InterviewProfile, interviewType = 'MIXED') {
    return scriptedQuestion(profile, [], undefined, interviewType);
  }

  async nextQuestion(
    profile: InterviewProfile,
    interviewType: string,
    _difficulty: string,
    asked: string[],
    last?: { question: string; answer: string },
  ) {
    return scriptedQuestion(profile, asked, last, interviewType);
  }

  async analyzeAnswer(
    profile: InterviewProfile,
    question: string,
    answer: string,
    options?: { answerMode?: 'TEXT' | 'AUDIO'; durationSec?: number },
  ) {
    if (options?.answerMode === 'AUDIO' || isAudioPlaceholderAnswer(answer)) {
      return analyzeAudioOnlyAnswer(options?.durationSec);
    }
    const conduct = detectConduct(answer);
    if (conduct === 'abuse') {
      return {
        analysis:
          'This response used abusive or vulgar language. That is unprofessional and must not be scored as strong behaviour.',
        improvedAnswer: 'I will answer this question professionally without abusive language.',
        strengths: [] as string[],
        weaknesses: ['Used abusive or vulgar language', 'Did not answer the question professionally'],
        score: 0,
      };
    }
    if (conduct === 'nonsense') {
      return {
        analysis: 'This response was not a meaningful answer to the interview question.',
        improvedAnswer: 'I will give a clear, relevant answer based on my real experience.',
        strengths: [] as string[],
        weaknesses: ['Answer was meaningless or too vague'],
        score: 5,
      };
    }
    const fromAi = await this.askJson<{
      analysis: string;
      improvedAnswer: string;
      strengths: string[];
      weaknesses: string[];
      score: number;
    }>(
      [
        'You are an expert interview coach evaluating ONE specific interview answer.',
        'Return unique feedback for THIS question and THIS answer only — do not reuse generic phrases across questions.',
        'Score 0-100 based on relevance to the question, clarity, depth, communication, and (for technical questions) accuracy.',
        'The improvedAnswer must rewrite only what the candidate actually said, using facts from their profile and answer. Never invent companies, tools, years, or achievements.',
        'If the answer is too short or vague, say so clearly and explain what was missing for this specific question.',
        'Return JSON { analysis, improvedAnswer, strengths, weaknesses, score }.',
      ].join(' '),
      JSON.stringify({
        profile: {
          fullName: profile.fullName,
          jobRole: profile.jobRole,
          skills: profile.skills,
          education: profile.education,
          experiences: profile.experiences,
          experienceYears: profile.experienceYears,
        },
        question,
        answer,
      }),
    );
    const local = localAnalyze(question, answer, profile);
    if (!fromAi) return local;
    const improvedAnswer = sanitizeImproved(answer, fromAi.improvedAnswer || '', profile);
    return {
      analysis: fromAi.analysis || local.analysis,
      improvedAnswer: improvedAnswer || undefined,
      strengths: fromAi.strengths?.length ? fromAi.strengths.slice(0, 4) : local.strengths,
      weaknesses: fromAi.weaknesses?.length ? fromAi.weaknesses.slice(0, 4) : local.weaknesses,
      score: clamp(fromAi.score ?? local.score, 0, 100),
    };
  }

  async report(
    profile: InterviewProfile,
    questions: LiveInterviewQuestion[],
    durationSec: number,
    warningCounts: InterviewReport['integrity'],
    totalPlanned = 15,
  ): Promise<InterviewReport> {
    const answered = questions.filter((item) => evaluableTextAnswer(item) || item.answerMode === 'AUDIO');
    const answeredCount = answered.length;
    const completionRatio = answeredCount / totalPlanned;
    const avg = answered.length
      ? Math.round(answered.reduce((sum, item) => sum + (item.score || 0), 0) / answered.length)
      : 0;
    const communication = scoreCommunication(answered);
    const behaviour = scoreBehaviour(answered, warningCounts);
    const listening = scoreListening(answered);
    const completionPenalty = Math.round((1 - completionRatio) * 30);
    const rawOverall = avg * 0.45 + communication * 5 + behaviour * 2.5 + listening * 2.5;
    const overall = clamp(Math.round(rawOverall - completionPenalty), 0, 100);
    const fromAi = await this.askJson<Partial<InterviewReport>>(
      'Summarize this interview. Do not invent experience. The candidate may have finished early — score only answered questions. If warningCounts show abuse, face missing, or tab switches, call that out clearly in summary and weaknesses, and do not praise behaviour. Return JSON { summary, strengths, weaknesses, dos, donts, recommendation } recommendation one of Strongly Recommended, Recommended, Needs Improvement, Not Ready.',
      JSON.stringify({
        profile,
        durationSec,
        warningCounts,
        answeredCount,
        totalPlanned,
        questions: answered,
      }),
    );
    const baseSummary =
      answeredCount === 0
        ? `No answers were submitted out of ${totalPlanned} planned questions.`
        : `${answeredCount} answer${answeredCount === 1 ? '' : 's'} given out of ${totalPlanned}. Overall scoring is based only on those ${answeredCount} response${answeredCount === 1 ? '' : 's'}.`;
    const integrityNote =
      (warningCounts.abuseWarnings || 0) > 0
        ? ` Integrity: ${warningCounts.abuseWarnings} abuse warning(s) were recorded — behaviour must be marked poor.`
        : '';
    const recommendation = recFromScore(
      overall,
      fromAi?.recommendation,
      answeredCount,
      totalPlanned,
      warningCounts,
    );
    const weaknesses = mergeIntegrityWeaknesses(
      (fromAi?.weaknesses?.length ? fromAi.weaknesses : defaultWeaknesses(answered, answeredCount, totalPlanned)).slice(0, 6),
      warningCounts,
    );
    return {
      overallScore: overall,
      communication,
      behaviour,
      listening,
      recommendation,
      summary: fromAi?.summary ? `${baseSummary} ${fromAi.summary}${integrityNote}` : `${baseSummary}${integrityNote}`,
      strengths:
        (warningCounts.abuseWarnings || 0) >= 2
          ? []
          : (fromAi?.strengths?.length ? fromAi.strengths : defaultStrengths(answered)).slice(0, 6),
      weaknesses,
      dos: (fromAi?.dos?.length ? fromAi.dos : DEFAULT_DOS).slice(0, 8),
      donts: mergeIntegrityDonts(
        (fromAi?.donts?.length ? fromAi.donts : DEFAULT_DONTS).slice(0, 8),
        warningCounts,
      ),
      answeredCount,
      totalPlanned,
      integrity: warningCounts,
    };
  }

  private async askJson<T>(system: string, user: string): Promise<T | null> {
    if (!this.aiGateway.isConfigured()) return null;
    const res = await this.aiGateway.generate<T>({
      task: 'INTERVIEW_EVALUATION',
      systemPrompt: system,
      userPrompt: user.slice(0, 12000),
      options: {
        temperature: 0.3,
      },
    });
    return res.data;
  }
}

export function profileFromResume(content: ResumeContent, jobRole: string): InterviewProfile {
  const projectBlob = [
    ...(content.experiences || []).map((item) => [item.jobTitle, item.company, item.description].join(' ')),
    ...(content.projects || []).map((item) => `${item.name} ${item.description || ''}`),
    content.summary || '',
  ].join(' ');
  return {
    fullName: content.fullName,
    city: content.city,
    skills: content.skills,
    education: content.education.map((item) =>
      [item.qualification, item.institution].filter(Boolean).join(' · '),
    ),
    experiences: [
      ...content.experiences.map((item) =>
        [item.jobTitle, item.company, item.description].filter(Boolean).join(' — '),
      ),
      ...(content.projects || []).map((item) => `Project: ${item.name}${item.description ? ` — ${item.description}` : ''}`),
    ],
    summary: [content.summary, content.certifications?.length ? `Certifications: ${content.certifications.join(', ')}` : '']
      .filter(Boolean)
      .join('\n'),
    jobRole,
    focusStacks: pickFocusStacks(content.skills || [], projectBlob),
    experienceYears: Number((content as ResumeContent & { experienceYears?: number }).experienceYears) || 0,
  };
}

function firstNameOf(fullName: string) {
  const part = fullName.trim().split(/\s+/).filter(Boolean)[0] || 'there';
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function projectHint(profile: InterviewProfile) {
  const project = profile.experiences.find((item) => /^Project:/i.test(item));
  if (project) {
    return project.replace(/^Project:\s*/i, '').split('—')[0].trim();
  }
  const job = profile.experiences[0];
  if (!job) return '';
  const title = job.split('—')[0].trim();
  return title;
}

function introQuestion(_name: string): BuiltQuestion {
  return {
    text: `Let's start with a brief introduction. Tell me about yourself and walk me through your background.`,
    category: 'INTRO',
    thinkSeconds: 0,
  };
}

function roleIntroQuestion(name: string, jobRole: string): BuiltQuestion {
  const role = jobRole || 'this role';
  return {
    text: `${name}, let's begin.\n\nTell me about yourself and walk me through your background as it relates to the ${role} position.`,
    category: 'INTRO',
    thinkSeconds: 0,
  };
}

function projectQuestion(profile: InterviewProfile): BuiltQuestion {
  const project = projectHint(profile);
  const stacks = profile.focusStacks.slice(0, 4).join(', ');
  const fresher = profile.experienceYears < 1;
  if (project && stacks) {
    return {
      text: `I noticed that you worked on ${project} using ${stacks}. Can you explain the architecture of the application and your specific contribution?`,
      category: 'PROJECT',
      thinkSeconds: 0,
      snippet: project,
    };
  }
  if (project) {
    return {
      text: `Thank you.\n\nPlease explain your project ${project}. What problem did it solve, what was your part, and which tools did you actually use?`,
      category: 'PROJECT',
      thinkSeconds: 0,
      snippet: project,
    };
  }
  if (fresher) {
    return {
      text: `Tell me about a challenging technical problem you faced in an academic or personal project, and how you handled it.`,
      category: 'PROJECT',
      thinkSeconds: 0,
    };
  }
  return {
    text: `Please explain one project from your resume. What was the problem, what did you build, and which tools did you actually use?`,
    category: 'PROJECT',
    thinkSeconds: 0,
  };
}

function experienceQuestion(profile: InterviewProfile): BuiltQuestion {
  const fresher = profile.experienceYears < 1;
  if (fresher) return projectQuestion(profile);
  const job = profile.experiences.find((item) => !/^Project:/i.test(item));
  if (job) {
    const title = job.split('—')[0].trim();
    return {
      text: `Walk me through your role as ${title}. What were your key responsibilities, and what impact did you have?`,
      category: 'EXPERIENCE',
      thinkSeconds: 0,
    };
  }
  return projectQuestion(profile);
}

function scenarioQuestion(profile: InterviewProfile, stacks: string[]): BuiltQuestion {
  const stack = stacks[0] || profile.skills[0] || 'your main stack';
  const fresher = profile.experienceYears < 1;
  if (fresher) {
    return {
      text: `Imagine you are building a ${profile.jobRole} project with ${stack}. How would you approach designing and implementing a core feature?`,
      category: 'SCENARIO',
      thinkSeconds: 0,
    };
  }
  return {
    text: `Suppose a production issue appears in your ${stack} application. How would you diagnose and resolve it?`,
    category: 'SCENARIO',
    thinkSeconds: 0,
  };
}

function roleReadinessQuestion(name: string, jobRole: string): BuiltQuestion {
  const role = jobRole || 'this role';
  return {
    text: `${name}, based on everything we have discussed, why do you believe you are ready for this ${role} position?`,
    category: 'ROLE_READINESS',
    thinkSeconds: 0,
  };
}

function buildRoleSlots(limit: number, years: number): string[] {
  const fresher = years < 1;
  if (limit <= 5) {
    return fresher
      ? ['PROJECT', 'TECH', 'SCENARIO', 'BEHAVIOURAL']
      : ['EXPERIENCE', 'PROJECT', 'TECH', 'BEHAVIOURAL'];
  }
  if (limit <= 8) {
    const slots = ['EXPERIENCE', 'PROJECT', 'TECH', 'TECH', 'SCENARIO', 'BEHAVIOURAL', 'READINESS'];
    return slots.slice(0, limit - 1);
  }
  const slots = [
    'EXPERIENCE',
    'PROJECT',
    'TECH',
    'TECH',
    'SCENARIO',
    'PROBLEM',
    'SCENARIO',
    'BEHAVIOURAL',
    'READINESS',
  ];
  return slots.slice(0, limit - 1);
}

function roleQuestionAt(
  profile: InterviewProfile,
  stacks: string[],
  name: string,
  asked: string[],
  last: { question: string; answer: string } | undefined,
  n: number,
): BuiltQuestion {
  const limit = profile.questionLimit || 10;
  const slots = buildRoleSlots(limit, profile.experienceYears);
  const slot = slots[Math.min(n - 1, slots.length - 1)] || 'TECH';
  switch (slot) {
    case 'EXPERIENCE':
      return experienceQuestion(profile);
    case 'PROJECT':
      return projectQuestion(profile);
    case 'TECH':
      return nextTech(profile, stacks, name, asked, last, n);
    case 'SCENARIO':
    case 'PROBLEM':
      return scenarioQuestion(profile, stacks);
    case 'BEHAVIOURAL':
      return pickUnused(roleBank(name, profile.jobRole), asked);
    case 'READINESS':
      return roleReadinessQuestion(name, profile.jobRole);
    default:
      return nextTech(profile, stacks, name, asked, last, n);
  }
}

function maybeFollowUp(
  profile: InterviewProfile,
  asked: string[],
  last?: { question: string; answer: string },
): BuiltQuestion | null {
  if (!last?.answer?.trim() || asked.length < 2) return null;
  if (asked.length % 3 !== 0) return null;
  const answer = last.answer;
  const lower = answer.toLowerCase();
  const triggers: Array<{ pattern: RegExp; question: string }> = [
    {
      pattern: /\bjwt\b/i,
      question: `You mentioned JWT authentication. Can you explain how you handled token validation and authorization on the backend?`,
    },
    {
      pattern: /\breact\b/i,
      question: `You mentioned React. Can you walk me through how you managed state and component structure in that project?`,
    },
    {
      pattern: /\bnode(\.js)?\b/i,
      question: `You brought up Node.js. How did you structure your API routes and handle errors on the server?`,
    },
    {
      pattern: /\bmongo(db)?\b/i,
      question: `You mentioned MongoDB. How did you design your data models and queries for that use case?`,
    },
    {
      pattern: /\bteam\b/i,
      question: `You mentioned working with a team. What was your specific contribution, and how did you coordinate with others?`,
    },
    {
      pattern: /\bchallenge|difficult|problem\b/i,
      question: `You described a challenge. What was the root cause, and what would you do differently if you faced it again?`,
    },
  ];
  for (const skill of profile.skills.slice(0, 8)) {
    if (skill.length > 3 && lower.includes(skill.toLowerCase())) {
      const follow = `You mentioned ${skill}. Can you go deeper into how you used it and what trade-offs you considered?`;
      if (!asked.includes(follow)) {
        return { text: follow, category: 'FOLLOW_UP', thinkSeconds: 0 };
      }
    }
  }
  for (const item of triggers) {
    if (item.pattern.test(answer)) {
      if (!asked.includes(item.question)) {
        return { text: item.question, category: 'FOLLOW_UP', thinkSeconds: 0 };
      }
    }
  }
  return null;
}

function normalizeKind(interviewType: string) {
  const kind = (interviewType || 'MIXED').toUpperCase();
  if (kind === 'GENERIC') return 'BEHAVIOURAL';
  if (kind === 'ROLE_BASED') return 'ROLE';
  return kind;
}

function pickUnused(bank: BuiltQuestion[], asked: string[]): BuiltQuestion {
  const unused = bank.filter((item) => !asked.includes(item.text));
  const pool = unused.length ? unused : bank;
  return pool[Math.floor(Math.random() * pool.length)] || pool[0];
}

function nextTech(
  profile: InterviewProfile,
  stacks: string[],
  name: string,
  asked: string[],
  last?: { question: string; answer: string },
  n = 0,
): BuiltQuestion {
  const unusedTech = techBank(stacks, name, profile.experienceYears).filter((item) => !asked.includes(item.text));
  if (profile.experienceYears >= 1 && /javascript|\bjs\b|react|node/i.test(last?.answer || '') && n === 2) {
    const output = unusedTech.find((item) => item.snippet && /javascript/i.test(item.category));
    if (output) return output;
  }
  return unusedTech[n % Math.max(unusedTech.length, 1)] || unusedTech[0] || {
    text: `Walk me through how you used ${stacks[0] || 'your main stack'} in a real task.`,
    category: 'TECHNICAL',
    thinkSeconds: 0,
  };
}

function scriptedQuestion(
  profile: InterviewProfile,
  asked: string[],
  last?: { question: string; answer: string },
  interviewType = 'MIXED',
): BuiltQuestion {
  const name = firstNameOf(profile.fullName || 'there');
  const stacks = profile.focusStacks.length ? profile.focusStacks : pickFocusStacks(profile.skills, profile.experiences.join(' '));
  const n = asked.length;
  const kind = normalizeKind(interviewType);

  if (n <= 0) {
    if (kind === 'ROLE') return roleIntroQuestion(name, profile.jobRole);
    return introQuestion(name);
  }

  const follow = maybeFollowUp(profile, asked, last);
  if (follow && n > 1) return follow;

  if (kind === 'HR' || kind === 'BEHAVIOURAL' || kind === 'CUSTOMER_SERVICE' || kind === 'SITUATIONAL') {
    return pickUnused(hrBank(name, kind), asked);
  }

  if (kind === 'TECHNICAL') {
    return nextTech(profile, stacks, name, asked, last, n);
  }

  if (kind === 'ROLE') {
    return roleQuestionAt(profile, stacks, name, asked, last, n);
  }

  if (kind === 'RESUME') {
    if (n === 1) return projectQuestion(profile);
    return nextTech(profile, stacks, name, asked, last, n);
  }

  if (n === 1) return projectQuestion(profile);
  if (n >= 11) return pickUnused(hrBank(name, 'HR'), asked);
  return nextTech(profile, stacks, name, asked, last, n);
}

function pickFocusStacks(skills: string[], projectText: string): string[] {
  const primary = detectStacks(skills.join(' '));
  const inProjects = detectStacks(projectText);
  const overlap = primary.filter((item) => inProjects.includes(item));
  const ordered = [
    ...overlap,
    ...inProjects.filter((item) => !overlap.includes(item)),
    ...primary.filter((item) => !overlap.includes(item) && !inProjects.includes(item)),
  ];
  return [...new Set(ordered)].slice(0, 5);
}

function detectStacks(raw: string): string[] {
  const text = ` ${raw.toLowerCase().replace(/[._]/g, ' ')} `;
  return STACKS.filter((item) => item.keys.some((key) => text.includes(` ${key} `) || text.includes(key))).map((item) => item.id);
}

const STACKS = [
  { id: 'JavaScript', keys: ['javascript', ' js ', 'es6', 'ecmascript'] },
  { id: 'React.js', keys: ['react', 'reactjs'] },
  { id: 'Node.js', keys: ['node', 'nodejs', 'express'] },
  { id: 'SQL', keys: ['sql', 'mysql', 'postgres', 'postgresql', 'sqlite'] },
  { id: 'HTML', keys: ['html', 'html5'] },
  { id: 'CSS', keys: ['css', 'css3', 'tailwind', 'sass', 'scss'] },
  { id: 'Java', keys: ['java', 'spring boot', 'spring'] },
  { id: 'Python', keys: ['python', 'django', 'flask'] },
  { id: 'TypeScript', keys: ['typescript'] },
  { id: 'MongoDB', keys: ['mongodb', 'mongo'] },
];

function experienceBand(years: number): 'FRESHER' | 'YEAR_1' | 'YEAR_2_3' | 'YEAR_4_PLUS' {
  if (years < 1) return 'FRESHER';
  if (years < 2) return 'YEAR_1';
  if (years < 4) return 'YEAR_2_3';
  return 'YEAR_4_PLUS';
}

function techBank(stacks: string[], name: string, years: number): BuiltQuestion[] {
  const band = experienceBand(years);
  const picked = stacks.flatMap((stack) => questionsForStack(stack, name, band));
  return picked.length ? shuffle(picked) : shuffle(stacks.flatMap((stack) => questionsForStack(stack, name, 'FRESHER')));
}

function q(category: string, text: string, extra: Partial<BuiltQuestion> = {}): BuiltQuestion {
  return { category, text, thinkSeconds: 0, snippet: null, ...extra };
}

function questionsForStack(stack: string, name: string, band: ReturnType<typeof experienceBand>): BuiltQuestion[] {
  const fresher: Record<string, BuiltQuestion[]> = {
    JavaScript: [
      q('TECHNICAL-JS', `${name}, you have JavaScript on your profile.\n\nWhat is JavaScript, and why do we use it in web applications?`),
      q('TECHNICAL-JS', `In simple words, what is the difference between JavaScript in the browser and JavaScript on the server?`),
    ],
    'React.js': [
      q('TECHNICAL-REACT', `${name}, your project uses React.\n\nWhat is React, and why do people use it instead of only HTML and JavaScript?`),
      q('TECHNICAL-REACT', `What are React hooks?\n\nName one or two hooks you know, and say what they are used for.`),
    ],
    'Node.js': [
      q('TECHNICAL-NODE', `What is Node.js, and why is it used in a project like yours?`),
      q('TECHNICAL-NODE', `What is the difference between Node.js and a normal JavaScript file that runs in the browser?`),
    ],
    SQL: [
      q('TECHNICAL-SQL', `What is SQL, and why do we use it with a database?`),
      q('TECHNICAL-SQL', `What is the difference between a table and a row, in simple words?`),
    ],
    HTML: [q('TECHNICAL-HTML', `What is HTML, and why do we need it in a website?`)],
    CSS: [q('TECHNICAL-CSS', `What is CSS, and why do we use it with HTML?`)],
    Java: [q('TECHNICAL-JAVA', `What is Java, and why would a company use it?`)],
    Python: [q('TECHNICAL-PYTHON', `What is Python, and why is it used?`)],
    TypeScript: [q('TECHNICAL-TS', `What is TypeScript, and why add it on top of JavaScript?`)],
    MongoDB: [q('TECHNICAL-MONGO', `What is MongoDB, and when would you use it?`)],
  };

  const year1: Record<string, BuiltQuestion[]> = {
    JavaScript: [
      q('TECHNICAL-JS', `What is the difference between let, const, and var?`),
      q(
        'TECHNICAL-JS',
        `${name}, look at this JavaScript on the screen.\n\nWhat will be the output of 1 + '1'? Take five seconds, then explain.`,
        { snippet: "1 + '1'", thinkSeconds: 5 },
      ),
    ],
    'React.js': [
      q('TECHNICAL-REACT', `What is the difference between state and props in React?`),
      q('TECHNICAL-REACT', `What does useState do, and when would you use useEffect?`),
    ],
    'Node.js': [
      q('TECHNICAL-NODE', `What is npm, and how is it different from Node.js itself?`),
      q('TECHNICAL-NODE', `What is an API in a Node.js project, in your own words?`),
    ],
    SQL: [
      q('TECHNICAL-SQL', `What is the difference between WHERE and HAVING?`),
      q('TECHNICAL-SQL', `What does a primary key do?`),
    ],
    HTML: [q('TECHNICAL-HTML', `What is the difference between a div and a semantic tag like header?`)],
    CSS: [q('TECHNICAL-CSS', `What is the difference between margin and padding?`)],
    Java: [q('TECHNICAL-JAVA', `What is the difference between JDK, JRE, and JVM, in short?`)],
    Python: [q('TECHNICAL-PYTHON', `What is a list versus a tuple in Python?`)],
    TypeScript: [q('TECHNICAL-TS', `What is a type error, and why is that useful before runtime?`)],
    MongoDB: [q('TECHNICAL-MONGO', `What is a document in MongoDB compared to a SQL row?`)],
  };

  const year23: Record<string, BuiltQuestion[]> = {
    JavaScript: [
      q(
        'TECHNICAL-JS',
        `${name}, look at this JavaScript expression on the screen.\n\nWhat will be the output of 1 + '1'? Take five seconds to think, then I will ask you to explain.`,
        { snippet: "1 + '1'", thinkSeconds: 5 },
      ),
      q('TECHNICAL-JS', `How does JavaScript work behind the scenes?\n\nTalk about the call stack, heap, and event loop in your own words.`),
    ],
    'React.js': [
      q('TECHNICAL-REACT', `Explain how state updates work, and when you would lift state up.`),
      q(
        'TECHNICAL-REACT',
        `Look at this React snippet on the screen.\n\nWhat does an empty dependency array mean, and what bug happens if you forget it?`,
        { snippet: 'useEffect(() => { fetch() }, [])', thinkSeconds: 5 },
      ),
    ],
    'Node.js': [
      q('TECHNICAL-NODE', `How does the Node event loop handle a slow database call without blocking the server?`),
      q('TECHNICAL-NODE', `When would you use middleware, and what should happen if an error is thrown in one?`),
    ],
    SQL: [
      q(
        'TECHNICAL-SQL',
        `Look at this SQL on the screen.\n\nWhat is the difference between this LEFT JOIN and an INNER JOIN?`,
        { snippet: 'SELECT * FROM users LEFT JOIN orders ON users.id = orders.user_id', thinkSeconds: 5 },
      ),
      q('TECHNICAL-SQL', `How would you find duplicate emails in a users table?`),
    ],
    HTML: [q('TECHNICAL-HTML', `Why does semantic markup matter for accessibility and SEO?`)],
    CSS: [
      q(
        'TECHNICAL-CSS',
        `Look at these CSS lines.\n\nWhat is the difference, including layout space?`,
        { snippet: 'display: none;  vs  visibility: hidden;', thinkSeconds: 5 },
      ),
    ],
    Java: [q('TECHNICAL-JAVA', `How does the JVM load and run a class, in simple steps?`)],
    Python: [q('TECHNICAL-PYTHON', `How does the GIL affect a CPU-heavy Python program?`)],
    TypeScript: [q('TECHNICAL-TS', `Why use TypeScript in a real project you have worked on?`)],
    MongoDB: [q('TECHNICAL-MONGO', `When would you pick MongoDB over SQL for a project you have actually seen?`)],
  };

  const year4: Record<string, BuiltQuestion[]> = {
    JavaScript: [
      q('TECHNICAL-JS', `Explain closures and a real bug they can cause if you are not careful.`),
      q('TECHNICAL-JS', `How would you debug a memory leak in a long-running JavaScript app?`),
    ],
    'React.js': [
      q('TECHNICAL-REACT', `How does React reconciliation work, and when would you memoize a component?`),
      q('TECHNICAL-REACT', `How would you design data fetching so a screen does not flicker or race?`),
    ],
    'Node.js': [
      q('TECHNICAL-NODE', `How would you design retries, timeouts, and back-pressure for a Node API?`),
      q('TECHNICAL-NODE', `Cluster vs worker threads: when would you pick each?`),
    ],
    SQL: [
      q('TECHNICAL-SQL', `How would you speed up a slow query: indexes, explain plans, and what you would not do?`),
      q('TECHNICAL-SQL', `How do you think about transactions and isolation in an order-payment flow?`),
    ],
    HTML: [q('TECHNICAL-HTML', `How do you keep a large HTML app accessible without slowing the team down?`)],
    CSS: [q('TECHNICAL-CSS', `How would you structure CSS so a 20-page product does not become unmaintainable?`)],
    Java: [q('TECHNICAL-JAVA', `How would you reason about garbage collection pauses in a busy Java service?`)],
    Python: [q('TECHNICAL-PYTHON', `When would you move a Python bottleneck to async, multiprocessing, or another language?`)],
    TypeScript: [q('TECHNICAL-TS', `How do you keep types useful without making the codebase too strict to ship?`)],
    MongoDB: [q('TECHNICAL-MONGO', `How would you model a high-write collection to avoid hot shards or huge documents?`)],
  };

  const table = band === 'FRESHER' ? fresher : band === 'YEAR_1' ? year1 : band === 'YEAR_2_3' ? year23 : year4;
  return table[stack] || fresher[stack] || [];
}

function hrBank(name: string, kind = 'HR'): BuiltQuestion[] {
  const hr = [
    `${name}, where do you want to see yourself in five years, in a realistic way?`,
    `What is one real strength you bring to a team, with an example?`,
    `What is one weakness you are actively working on, and how?`,
    `Tell me about a time you disagreed with a teammate. What did you do?`,
    `How do you handle a missed deadline?`,
    `Why should a hiring manager pick you, using only work you have really done?`,
    `Describe a failure at work or college, and what you changed after it.`,
    `How do you take critical feedback?`,
    `Tell me about a time you had too much work. How did you prioritise?`,
    `What kind of manager helps you do your best work?`,
    `How do you learn a new tool when the project needs it next week?`,
    `Tell me about a time you had to explain a technical idea to a non-technical person.`,
    `What does a good work day look like for you?`,
    `Have you ever had to own a mistake in front of others? What happened?`,
    `What would you do in the first 30 days if you joined a new team?`,
    `How do you stay calm when a customer or teammate is upset?`,
    `Tell me about a time you had to say no at work. How did you handle it?`,
    `What motivates you to come to work besides salary?`,
    `How do you build trust with people you have just met on a team?`,
    `Describe a time you helped someone else succeed.`,
    `How do you prepare before a meeting or an interview?`,
    `What does professionalism mean to you in a daily job?`,
    `Tell me about a time you had to change your plan quickly.`,
    `How would your last teammate describe working with you?`,
  ];
  const situational = [
    `A teammate is not delivering. What do you do in the first week?`,
    `You are given two urgent tasks and can finish only one. How do you decide?`,
    `A client is unhappy with a delay you did not cause. What do you say?`,
    `You notice a mistake in work that already went out. What is your first step?`,
    `Someone takes credit for your work in a meeting. How do you respond?`,
  ];
  const lines = kind === 'SITUATIONAL' || kind === 'CUSTOMER_SERVICE' ? [...situational, ...hr] : hr;
  return shuffle(lines).map((text) => ({ text, category: kind === 'BEHAVIOURAL' ? 'BEHAVIOURAL' : 'HR', thinkSeconds: 0 }));
}

function roleBank(name: string, jobRole: string): BuiltQuestion[] {
  const role = jobRole || 'this role';
  const lines = [
    `${name}, why this ${role} path, based on work you have actually done?`,
    `What does a good first month look like in ${role}?`,
    `Which part of ${role} do you already know, and which part would you need to learn?`,
    `How would you measure success in ${role} after six months?`,
    `What stakeholder would you talk to first in ${role}, and why?`,
  ];
  return shuffle(lines).map((text) => ({ text, category: 'ROLE', thinkSeconds: 0 }));
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function fallbackQuestion(
  profile: InterviewProfile,
  asked: string[],
  _last?: { question: string; answer: string },
) {
  return scriptedQuestion(profile, asked, _last, 'MIXED');
}

function analyzeAudioOnlyAnswer(durationSec = 0) {
  const spokeLongEnough = durationSec >= 12;
  return {
    analysis: spokeLongEnough
      ? 'You submitted an audio answer. We saved your recording, but typed answers help us give detailed, question-specific feedback.'
      : 'You submitted a short audio answer. Try speaking a little longer, or add a short written summary for better AI feedback.',
    improvedAnswer: '',
    strengths: spokeLongEnough ? ['Completed the spoken practice'] : ['Attempted a spoken answer'],
    weaknesses: ['Add a written summary with your audio answer so AI can evaluate your content'],
    score: spokeLongEnough ? 48 : 40,
  };
}

function localAnalyze(question: string, answer: string, profile: InterviewProfile) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const relevant = overlap(answer, `${question} ${profile.skills.join(' ')} ${profile.jobRole}`);
  const score = clamp(40 + Math.min(30, words.length) + relevant * 4, 35, 92);
  const improved = improveLocal(answer, profile);
  const questionHint = question.split(/[.?\n]/).find((line) => line.trim().length > 12)?.trim() || question.slice(0, 80);
  return {
    analysis:
      words.length < 20
        ? `For "${questionHint}", your answer was too brief. Add a real example from your background that directly addresses this question.`
        : `For "${questionHint}", you made relevant points. Structure your answer with situation, action, and result for more impact.`,
    improvedAnswer: improved || undefined,
    strengths: [
      words.length >= 20 ? 'You gave enough detail to follow' : 'You attempted the question',
      relevant ? 'You stayed close to the topic' : 'You stayed professional',
    ],
    weaknesses: [
      words.length < 25 ? 'Add a concrete example tied to this question' : 'Tighten the opening sentence',
      'Mention your actual contribution, not only the team',
    ],
    score,
  };
}

function improveLocal(answer: string, profile: InterviewProfile) {
  const clean = answer.replace(/\s+/g, ' ').trim();
  if (!clean || isAudioPlaceholderAnswer(clean)) return '';
  const skill = profile.skills[0];
  let improved = `${clean.charAt(0).toUpperCase()}${clean.slice(1)}${clean.endsWith('.') ? '' : '.'}`;
  if (skill && !clean.toLowerCase().includes(skill.toLowerCase()) && clean.length < 120) {
    improved += ` This connects to my experience with ${skill}.`;
  }
  if (improved.length < 40 && profile.jobRole) {
    improved += ` I am preparing for ${profile.jobRole} roles.`;
  }
  return improved.trim();
}

function sanitizeImproved(original: string, improved: string, profile: InterviewProfile) {
  if (!improved.trim() || isAudioPlaceholderAnswer(original) || isAudioPlaceholderAnswer(improved)) {
    return '';
  }
  const allowed = `${original} ${profile.fullName} ${profile.skills.join(' ')} ${profile.experiences.join(' ')} ${profile.summary}`.toLowerCase();
  if (/\d{2,}/.test(improved) && !/\d{2,}/.test(original) && !allowed.match(/\d{2,}/)) {
    return improveLocal(original, profile);
  }
  const cleaned = improved.trim();
  if (!cleaned || isAudioPlaceholderAnswer(cleaned)) return '';
  return cleaned;
}

function scoreCommunication(questions: LiveInterviewQuestion[]) {
  const textAnswers = questions
    .map((item) => evaluableTextAnswer(item))
    .filter(Boolean);
  if (!textAnswers.length) return 4;
  const words = textAnswers.reduce((sum, item) => sum + item.split(/\s+/).length, 0) / textAnswers.length;
  return clamp(Math.round(3 + Math.min(7, words / 18)), 1, 10);
}

function scoreBehaviour(questions: LiveInterviewQuestion[], integrity?: InterviewReport['integrity']) {
  if (!questions.length) return 2;

  const abuseInAnswers = questions.filter((item) => detectConduct(item.answer || '') === 'abuse').length;
  const nonsenseInAnswers = questions.filter((item) => detectConduct(item.answer || '') === 'nonsense').length;
  const abuse = Math.max(integrity?.abuseWarnings || 0, abuseInAnswers);
  const nonsense = Math.max(integrity?.nonsenseWarnings || 0, nonsenseInAnswers);
  const faceMissing = integrity?.faceMissing || 0;
  const tabSwitches = integrity?.tabSwitches || 0;
  const multipleFaces = integrity?.multipleFaces || 0;

  // Abuse must never look like strong behaviour (fixes 9/10 after vulgar answers).
  if (abuse >= 3) return 1;
  if (abuse >= 2) return 2;
  if (abuse >= 1) return 3;

  const rude = questions.some((item) => /stupid|hate|idk lol|whatever|shut up/i.test(item.answer || ''));
  const complete = questions.filter((item) => (item.answer || '').length > 40).length / questions.length;
  let base = clamp(Math.round((rude ? 3 : 7) + complete * 3), 1, 10);
  base = clamp(
    base - nonsense * 2 - faceMissing * 2 - tabSwitches * 1 - multipleFaces * 1,
    1,
    10,
  );
  return base;
}

function scoreListening(questions: LiveInterviewQuestion[]) {
  if (!questions.length) return 2;
  const hits = questions.filter((item) => overlap(item.answer || '', item.text) >= 1).length;
  return clamp(Math.round(3 + (hits / questions.length) * 7), 1, 10);
}

function overlap(a: string, b: string) {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'you', 'your', 'me', 'i', 'with']);
  const words = b
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((item) => item.length > 3 && !stop.has(item));
  return words.filter((item) => a.toLowerCase().includes(item)).length;
}

function recFromScore(
  score: number,
  raw?: string,
  answeredCount = 15,
  totalPlanned = 15,
  integrity?: InterviewReport['integrity'],
): InterviewReport['recommendation'] {
  const allowed = ['Strongly Recommended', 'Recommended', 'Needs Improvement', 'Not Ready'] as const;
  let pick: InterviewReport['recommendation'] =
    score >= 85 ? 'Strongly Recommended' : score >= 70 ? 'Recommended' : score >= 55 ? 'Needs Improvement' : 'Not Ready';
  if (answeredCount < Math.ceil(totalPlanned * 0.4)) pick = 'Not Ready';
  else if (answeredCount < Math.ceil(totalPlanned * 0.6) && pick === 'Strongly Recommended') pick = 'Recommended';
  if ((integrity?.abuseWarnings || 0) >= 1) pick = 'Not Ready';
  if ((integrity?.faceMissing || 0) >= 3 && pick === 'Strongly Recommended') pick = 'Needs Improvement';
  if (raw && (allowed as readonly string[]).includes(raw)) {
    // Never let the model override abuse into a positive recommendation.
    if ((integrity?.abuseWarnings || 0) >= 1) return 'Not Ready';
    return raw as InterviewReport['recommendation'];
  }
  return pick;
}

function mergeIntegrityWeaknesses(base: string[], integrity?: InterviewReport['integrity']) {
  const extra: string[] = [];
  if ((integrity?.abuseWarnings || 0) > 0) {
    extra.push('Used abusive or vulgar language during the interview');
  }
  if ((integrity?.faceMissing || 0) > 0) {
    extra.push('Left the camera / face was not visible while answering');
  }
  if ((integrity?.tabSwitches || 0) > 0) {
    extra.push('Switched away from the interview tab');
  }
  return [...extra, ...base.filter((item) => !extra.includes(item))].slice(0, 6);
}

function mergeIntegrityDonts(base: string[], integrity?: InterviewReport['integrity']) {
  const extra: string[] = [];
  if ((integrity?.abuseWarnings || 0) > 0) extra.push('Never use abusive or vulgar language');
  if ((integrity?.faceMissing || 0) > 0) extra.push('Stay on camera with your face clearly visible');
  return [...extra, ...base.filter((item) => !extra.includes(item))].slice(0, 8);
}

function defaultStrengths(questions: LiveInterviewQuestion[]) {
  return questions.length
    ? ['Showed up and completed the practice', 'Gave answers in your own words']
    : ['Started the interview'];
}

function defaultWeaknesses(questions: LiveInterviewQuestion[], answeredCount = 0, totalPlanned = 15) {
  const items: string[] = [];
  if (answeredCount < totalPlanned) {
    items.push(`Only ${answeredCount} of ${totalPlanned} questions were answered — overall score reflects partial completion`);
  }
  if (questions.some((item) => (item.answer || '').split(/\s+/).length < 20)) {
    items.push('Some answers were too short — add real examples from your profile');
  } else {
    items.push('Structure answers more clearly');
  }
  return items;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} min ${s} sec`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

const DEFAULT_DOS = [
  'Give concise, structured answers.',
  'Use real examples from your experience.',
  'Explain your contribution, not only the team.',
  'Listen to the full question before answering.',
  'Be honest about what you have not done yet.',
];

const DEFAULT_DONTS = [
  'Do not invent companies, tools, or achievements.',
  'Do not switch tabs during a live interview.',
  'Do not let someone else answer for you.',
  'Do not give one-line answers when an example is needed.',
  'Do not memorize a script word-for-word.',
];
