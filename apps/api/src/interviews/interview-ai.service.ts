import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { InterviewReport, LiveInterviewQuestion, ResumeContent } from '@careerbridge/shared';

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
};

type BuiltQuestion = {
  text: string;
  category: string;
  snippet?: string | null;
  thinkSeconds?: number;
};

@Injectable()
export class InterviewAiService {
  constructor(private readonly config: ConfigService) {}

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

  async analyzeAnswer(profile: InterviewProfile, question: string, answer: string) {
    const fromAi = await this.askJson<{
      analysis: string;
      improvedAnswer: string;
      strengths: string[];
      weaknesses: string[];
      score: number;
    }>(
      'Analyze the candidate answer. Improve wording only using facts from the profile and the answer. Correct grammar and structure. Suggest what could be added only if it is already implied by their answer or profile. Never invent companies, years, tools, or achievements. Return JSON { analysis, improvedAnswer, strengths, weaknesses, score } where score is 0-100.',
      JSON.stringify({ profile, question, answer }),
    );
    const local = localAnalyze(question, answer, profile);
    if (!fromAi) return local;
    return {
      analysis: fromAi.analysis || local.analysis,
      improvedAnswer: sanitizeImproved(answer, fromAi.improvedAnswer || local.improvedAnswer, profile),
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
  ): Promise<InterviewReport> {
    const totalPlanned = 15;
    const answered = questions.filter((item) => (item.answer || '').trim().length > 0);
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
      'Summarize this interview. Do not invent experience. The candidate may have finished early — score only answered questions. Return JSON { summary, strengths, weaknesses, dos, donts, recommendation } recommendation one of Strongly Recommended, Recommended, Needs Improvement, Not Ready.',
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
    return {
      overallScore: overall,
      communication,
      behaviour,
      listening,
      recommendation: recFromScore(overall, fromAi?.recommendation, answeredCount, totalPlanned),
      summary: fromAi?.summary ? `${baseSummary} ${fromAi.summary}` : baseSummary,
      strengths: (fromAi?.strengths?.length ? fromAi.strengths : defaultStrengths(answered)).slice(0, 6),
      weaknesses: (fromAi?.weaknesses?.length ? fromAi.weaknesses : defaultWeaknesses(answered, answeredCount, totalPlanned)).slice(0, 6),
      dos: (fromAi?.dos?.length ? fromAi.dos : DEFAULT_DOS).slice(0, 8),
      donts: (fromAi?.donts?.length ? fromAi.donts : DEFAULT_DONTS).slice(0, 8),
      answeredCount,
      totalPlanned,
      integrity: warningCounts,
    };
  }

  private async askJson<T>(system: string, user: string): Promise<T | null> {
    const apiKey =
      this.config.get<string>('OPENAI_API_KEY')?.trim() ||
      this.config.get<string>('Open_Ai_Api_key')?.trim() ||
      '';
    if (!apiKey) return null;
    try {
      const client = new OpenAI({ apiKey });
      const completion = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user.slice(0, 12000) },
        ],
      });
      const raw = completion.choices[0]?.message?.content;
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
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

function introQuestion(name: string): BuiltQuestion {
  return {
    text: `${name}, let us begin.\n\nPlease introduce yourself. Tell me who you are, what you have been doing, and what you want from this role.`,
    category: 'INTRO',
    thinkSeconds: 0,
  };
}

function projectQuestion(profile: InterviewProfile): BuiltQuestion {
  const project = projectHint(profile);
  return {
    text: project
      ? `Thank you.\n\nPlease explain your project ${project}. What problem did it solve, what was your part, and which tools did you actually use?`
      : `Thank you.\n\nPlease explain one project from your resume. What was the problem, what did you build, and which tools did you actually use?`,
    category: 'PROJECT',
    thinkSeconds: 0,
  };
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
  const kind = (interviewType || 'MIXED').toUpperCase();

  if (n <= 0) return introQuestion(name);

  if (kind === 'HR' || kind === 'BEHAVIOURAL' || kind === 'CUSTOMER_SERVICE' || kind === 'SITUATIONAL') {
    return pickUnused(hrBank(name, kind), asked);
  }

  if (kind === 'TECHNICAL') {
    return nextTech(profile, stacks, name, asked, last, n);
  }

  if (kind === 'ROLE') {
    if (n === 1) return projectQuestion(profile);
    if (n >= 10) return pickUnused(roleBank(name, profile.jobRole), asked);
    return nextTech(profile, stacks, name, asked, last, n);
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

function localAnalyze(question: string, answer: string, profile: InterviewProfile) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const relevant = overlap(answer, `${question} ${profile.skills.join(' ')} ${profile.jobRole}`);
  const score = clamp(40 + Math.min(30, words.length) + relevant * 4, 35, 92);
  const improved = improveLocal(answer, profile);
  return {
    analysis:
      words.length < 20
        ? 'Your answer was relevant but short. Add a specific example from your real experience.'
        : 'Your answer had useful points. Structure it more clearly: situation, what you did, and the result.',
    improvedAnswer: improved,
    strengths: [
      words.length >= 20 ? 'You gave enough detail to follow' : 'You attempted the question',
      relevant ? 'You stayed close to the topic' : 'You stayed professional',
    ],
    weaknesses: [
      words.length < 25 ? 'Add a concrete example' : 'Tighten the opening sentence',
      'Mention your actual contribution, not only the team',
    ],
    score,
  };
}

function improveLocal(answer: string, profile: InterviewProfile) {
  const clean = answer.replace(/\s+/g, ' ').trim();
  const skill = profile.skills[0];
  const name = profile.fullName || 'I';
  if (!clean) {
    return `${name} is preparing for ${profile.jobRole}${skill ? ` with experience in ${skill}` : ''}.`;
  }
  return `${clean.charAt(0).toUpperCase()}${clean.slice(1)}${clean.endsWith('.') ? '' : '.'}${
    skill && !clean.toLowerCase().includes(skill.toLowerCase())
      ? ` This draws on skills already listed, including ${skill}.`
      : ''
  }`;
}

function sanitizeImproved(original: string, improved: string, profile: InterviewProfile) {
  const allowed = `${original} ${profile.fullName} ${profile.skills.join(' ')} ${profile.experiences.join(' ')} ${profile.summary}`.toLowerCase();
  if (/\d{2,}/.test(improved) && !/\d{2,}/.test(original) && !allowed.match(/\d{2,}/)) {
    return improveLocal(original, profile);
  }
  return improved.trim() || improveLocal(original, profile);
}

function scoreCommunication(questions: LiveInterviewQuestion[]) {
  if (!questions.length) return 4;
  const words = questions.reduce((sum, item) => sum + (item.answer || '').split(/\s+/).length, 0) / questions.length;
  return clamp(Math.round(3 + Math.min(7, words / 18)), 1, 10);
}

function scoreBehaviour(questions: LiveInterviewQuestion[], integrity?: InterviewReport['integrity']) {
  if (!questions.length) return 2;
  const rude = questions.some((item) => /stupid|hate|idk lol|whatever/i.test(item.answer || ''));
  const complete = questions.filter((item) => (item.answer || '').length > 40).length / questions.length;
  let base = clamp(Math.round((rude ? 3 : 7) + complete * 3), 1, 10);
  const abuse = integrity?.abuseWarnings || 0;
  const nonsense = integrity?.nonsenseWarnings || 0;
  base = clamp(base - abuse * 3 - nonsense * 2, 1, 10);
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
): InterviewReport['recommendation'] {
  const allowed = ['Strongly Recommended', 'Recommended', 'Needs Improvement', 'Not Ready'] as const;
  let pick: InterviewReport['recommendation'] =
    score >= 85 ? 'Strongly Recommended' : score >= 70 ? 'Recommended' : score >= 55 ? 'Needs Improvement' : 'Not Ready';
  if (answeredCount < Math.ceil(totalPlanned * 0.4)) pick = 'Not Ready';
  else if (answeredCount < Math.ceil(totalPlanned * 0.6) && pick === 'Strongly Recommended') pick = 'Recommended';
  if (raw && (allowed as readonly string[]).includes(raw)) return raw as InterviewReport['recommendation'];
  return pick;
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
