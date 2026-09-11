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

  async firstQuestion(profile: InterviewProfile, interviewType = 'MIXED') {
    if (usesFixedIntro(interviewType)) {
      return introQuestion(profile, interviewType);
    }
    return this.generateQuestion(profile, interviewType, [], undefined);
  }

  async nextQuestion(
    profile: InterviewProfile,
    interviewType: string,
    _difficulty: string,
    asked: string[],
    last?: { question: string; answer: string },
  ) {
    return this.generateQuestion(profile, interviewType, asked, last);
  }

  private async generateQuestion(
    profile: InterviewProfile,
    interviewType: string,
    asked: string[],
    last?: { question: string; answer: string },
  ): Promise<BuiltQuestion> {
    if (!this.aiGateway.isConfigured()) {
      return emergencyProfileQuestion(profile, interviewType, asked);
    }

    const experienceYears = Number(profile.experienceYears) || 0;
    const experienceLevel =
      experienceYears < 1
        ? 'FRESHER'
        : experienceYears < 2
          ? 'YEAR_1'
          : experienceYears < 4
            ? 'YEAR_2_3'
            : 'YEAR_4_PLUS';

    const questionNumber = asked.length + 1;
    const profilePayload = {
      fullName: profile.fullName,
      jobRole: profile.jobRole,
      skills: profile.skills.slice(0, 25),
      education: profile.education.slice(0, 8),
      experiences: profile.experiences.slice(0, 12),
      focusStacks: profile.focusStacks,
      experienceYears,
      experienceLevel,
      summary: profile.summary?.slice(0, 800) || '',
      city: profile.city || null,
    };

    const attempts = 3;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const fromAi = await this.aiGateway.generateInterviewQuestion({
        interviewType,
        questionNumber,
        askedQuestions: asked.slice(-10),
        lastExchange: last || null,
        profile:
          attempt === 0
            ? profilePayload
            : { ...profilePayload, avoidQuestions: asked.slice(-10), retryAttempt: attempt + 1 },
        coverageFocus: coverageFocusForQuestion(questionNumber + attempt, interviewType, profile),
      });

      let text = (fromAi?.question || '').trim();
      if (!fromAi || text.length < 12) continue;
      if (asked.some((item) => item.toLowerCase() === text.toLowerCase())) continue;
      if (asked.length > 0 && isPureIntroQuestion(text)) continue;

      return {
        text,
        category: (fromAi.category || 'MIXED').toUpperCase(),
        snippet: fromAi.hint || null,
        thinkSeconds: clamp(Number(fromAi.thinkSeconds) || 0, 0, 30),
      };
    }

    // Never block the interview: build a profile-based next question if the LLM fails.
    return emergencyProfileQuestion(profile, interviewType, asked);
  }

  async analyzeAnswer(
    profile: InterviewProfile,
    question: string,
    answer: string,
    options?: { answerMode?: 'TEXT' | 'AUDIO'; durationSec?: number },
  ) {
    const text = answer.trim();
    const hasEvaluableText = text.length >= 8 && !isAudioPlaceholderAnswer(text);

    if (!hasEvaluableText && (options?.answerMode === 'AUDIO' || isAudioPlaceholderAnswer(text))) {
      return analyzeAudioOnlyAnswer(options?.durationSec);
    }

    const conduct = detectConduct(text);
    if (conduct === 'abuse') {
      return {
        analysis:
          'This response used abusive or vulgar language. That is unprofessional and must not be scored as strong behaviour.',
        improvedAnswer: buildProperAnswerFromProfile(question, profile),
        strengths: [] as string[],
        weaknesses: ['Used abusive or vulgar language', 'Did not answer the question professionally'],
        score: 0,
      };
    }
    if (conduct === 'nonsense') {
      return {
        analysis: 'This response was not a meaningful answer to the interview question.',
        improvedAnswer: buildProperAnswerFromProfile(question, profile),
        strengths: [] as string[],
        weaknesses: ['Answer was meaningless or too vague'],
        score: 25,
      };
    }

    if (!this.aiGateway.isConfigured()) {
      return softenScore(localAnalyze(question, text, profile));
    }

    const fromAi = await this.aiGateway.evaluateInterviewAnswer(
      {
        fullName: profile.fullName,
        jobRole: profile.jobRole,
        skills: profile.skills,
        education: profile.education,
        experiences: profile.experiences,
        experienceYears: profile.experienceYears,
        summary: profile.summary?.slice(0, 400) || '',
      },
      question,
      text,
      { temperature: 0.35 },
    );
    const local = localAnalyze(question, text, profile);
    if (!fromAi) return softenScore(local);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const improvedAnswer =
      sanitizeImproved(text, fromAi.improvedAnswer || '', profile, wordCount < 8) ||
      (wordCount < 8 ? buildProperAnswerFromProfile(question, profile) : improveLocal(text, profile));
    return softenScore({
      analysis: fromAi.analysis || local.analysis,
      improvedAnswer: improvedAnswer || undefined,
      strengths: fromAi.strengths?.length ? fromAi.strengths.slice(0, 4) : local.strengths,
      weaknesses: fromAi.weaknesses?.length ? fromAi.weaknesses.slice(0, 4) : local.weaknesses,
      score: clamp(fromAi.score ?? local.score, 0, 100),
    });
  }

  async report(
    profile: InterviewProfile,
    questions: LiveInterviewQuestion[],
    durationSec: number,
    warningCounts: InterviewReport['integrity'],
    totalPlanned = 15,
  ): Promise<InterviewReport> {
    const answered = questions.filter(
      (item) => evaluableTextAnswer(item) || item.answerMode === 'AUDIO' || Boolean(item.answer?.trim()),
    );
    const answeredCount = answered.length;
    // Overall must match average of per-question scores shown after each answer (/100 and /10).
    const overall = answered.length
      ? Math.round(answered.reduce((sum, item) => sum + (item.score || 0), 0) / answered.length)
      : 0;
    const overallOutOf10 = answered.length
      ? Math.round(
          answered.reduce((sum, item) => sum + Math.max(0, Math.min(10, Math.round((item.score || 0) / 10))), 0) /
            answered.length,
        )
      : 0;
    const communication = scoreCommunication(answered);
    const behaviour = scoreBehaviour(answered, warningCounts);
    const listening = scoreListening(answered);
    const fromAi = await this.askJson<Partial<InterviewReport>>(
      'Summarize this interview exactly from the answered questions and their scores. Do not invent experience. Keep the summary factual. Overall score must stay consistent with the per-question scores provided. Return JSON { summary, strengths, weaknesses, dos, donts, recommendation } recommendation one of Strongly Recommended, Recommended, Needs Improvement, Not Ready.',
      JSON.stringify({
        profile,
        durationSec,
        warningCounts,
        answeredCount,
        totalPlanned,
        overallScore: overall,
        overallOutOf10,
        questions: answered.map((item) => ({
          question: item.text,
          answer: item.answer,
          score: item.score,
          scoreOutOf10: Math.max(0, Math.min(10, Math.round((item.score || 0) / 10))),
          analysis: item.analysis,
          improvedAnswer: item.improvedAnswer,
        })),
      }),
    );
    const baseSummary =
      answeredCount === 0
        ? `No answers were submitted out of ${totalPlanned} planned questions.`
        : `You answered ${answeredCount} of ${totalPlanned} questions. Overall score ${overallOutOf10}/10 (${overall}/100) is the average of your per-question scores.`;
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

  private async askJson<T>(
    system: string,
    user: string,
    task: 'INTERVIEW_EVALUATION' | 'INTERVIEW_QUESTION' = 'INTERVIEW_EVALUATION',
  ): Promise<T | null> {
    if (!this.aiGateway.isConfigured()) return null;
    const res = await this.aiGateway.generate<T>({
      task,
      systemPrompt: system,
      userPrompt: user.slice(0, 12000),
      options: {
        temperature: task === 'INTERVIEW_QUESTION' ? 0.55 : 0.35,
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

function usesFixedIntro(interviewType: string) {
  const kind = (interviewType || 'MIXED').toUpperCase();
  return (
    kind === 'ROLE' ||
    kind === 'ROLE_BASED' ||
    kind === 'BEHAVIOURAL' ||
    kind === 'GENERIC' ||
    kind === 'HR' ||
    kind === 'MIXED'
  );
}

function introQuestion(profile: InterviewProfile, interviewType: string): BuiltQuestion {
  const kind = (interviewType || 'MIXED').toUpperCase();
  const role = profile.jobRole?.trim() || 'this role';
  if (kind === 'ROLE' || kind === 'ROLE_BASED') {
    return {
      text: `Tell me about yourself. Who are you, and walk me through your background as it relates to the ${role} role?`,
      category: 'INTRO',
      snippet: null,
      thinkSeconds: 0,
    };
  }
  return {
    text: 'Tell me about yourself. Who are you, and walk me through your background?',
    category: 'INTRO',
    snippet: null,
    thinkSeconds: 0,
  };
}

function isPureIntroQuestion(text: string) {
  return /^\s*tell me about yourself\b/i.test(text || '');
}

function emergencyProfileQuestion(
  profile: InterviewProfile,
  interviewType: string,
  asked: string[],
): BuiltQuestion {
  const kind = (interviewType || 'MIXED').toUpperCase();
  const skill = profile.skills.find((item) => item.trim().length > 1) || profile.focusStacks[0] || 'your skills';
  const project =
    profile.experiences.find((item) => /^Project:/i.test(item))?.replace(/^Project:\s*/i, '').split('—')[0]?.trim() ||
    '';
  const job =
    profile.experiences.find((item) => !/^Project:/i.test(item))?.split('—')[0]?.trim() || '';
  const education = profile.education[0] || '';
  const role = profile.jobRole || 'this role';

  const candidates: BuiltQuestion[] = [
    education
      ? {
          text: `Looking at your education (${education}), what did you learn that you can apply in a real ${role} role?`,
          category: 'EDUCATION',
          thinkSeconds: 0,
        }
      : null,
    project
      ? {
          text: `Tell me about your project ${project}. What was your contribution, and which tools did you use?`,
          category: 'PROJECT',
          thinkSeconds: 0,
          snippet: project,
        }
      : null,
    job
      ? {
          text: `Walk me through your experience as ${job}. What were your main responsibilities?`,
          category: 'EXPERIENCE',
          thinkSeconds: 0,
        }
      : null,
    {
      text: `You listed ${skill} on your profile. In simple words, what is it and how have you used it?`,
      category: 'TECHNICAL',
      thinkSeconds: 0,
    },
    kind === 'ROLE' || kind === 'ROLE_BASED'
      ? {
          text: `Why are you interested in the ${role} path, based on your background so far?`,
          category: 'ROLE',
          thinkSeconds: 0,
        }
      : {
          text: `Tell me about a challenge you faced while learning or building something related to ${skill}. How did you handle it?`,
          category: 'BEHAVIOURAL',
          thinkSeconds: 0,
        },
    {
      text: `Which part of ${role} work do you already feel comfortable with, and which part would you still need to learn?`,
      category: 'ROLE',
      thinkSeconds: 0,
    },
  ].filter(Boolean) as BuiltQuestion[];

  const unused = candidates.filter((item) => !asked.some((q) => q.toLowerCase() === item.text.toLowerCase()));
  return unused[asked.length % Math.max(unused.length, 1)] || unused[0] || candidates[0];
}

function coverageFocusForQuestion(
  questionNumber: number,
  interviewType: string,
  profile: InterviewProfile,
): string {
  const kind = (interviewType || 'MIXED').toUpperCase();
  const hasProjects = profile.experiences.some((item) => /^Project:/i.test(item));
  const hasJobs = profile.experiences.some((item) => !/^Project:/i.test(item));
  const rotation = [
    'education and academic or learning background from the full profile',
    hasProjects
      ? 'a project from the profile (pick a different project/topic than prior questions)'
      : 'a concrete experience or responsibility from the profile',
    hasJobs
      ? 'work or internship experience from the profile'
      : 'skills listed on the profile (pick skills not already deeply covered)',
    'technical skills or tools from the profile (cover a different skill area than earlier questions)',
    kind === 'ROLE' || kind === 'ROLE_BASED'
      ? `role readiness for ${profile.jobRole || 'this role'} using profile facts`
      : 'behavioural situation using something real from the profile',
    'another uncovered part of the profile: education, skills, project, experience, or soft skills',
    'a scenario tied to the job role using profile skills — do not repeat earlier topics',
  ];
  // questionNumber 1 is fixed intro; LLM starts at 2 → index 0
  const index = Math.max(0, questionNumber - 2) % rotation.length;
  return rotation[index];
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

function analyzeAudioOnlyAnswer(durationSec = 0) {
  const spokeLongEnough = durationSec >= 12;
  return {
    analysis: spokeLongEnough
      ? 'You submitted an audio answer. Speech text was limited, so scoring is based mainly on completion and length.'
      : 'Your audio answer was short. Try speaking a bit longer so the interview can capture more of your response.',
    improvedAnswer: '',
    strengths: spokeLongEnough ? ['Completed the spoken practice'] : ['Attempted a spoken answer'],
    weaknesses: spokeLongEnough
      ? ['Speech capture was limited for this answer']
      : ['Answer was too short to evaluate in detail'],
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

function softenScore<T extends { score: number }>(result: T): T {
  const score = result.score;
  if (score <= 0) return result;
  // Encourage sincere attempts without making scores unrealistically perfect.
  const boosted = score < 40 ? score + 8 : score < 70 ? score + 10 : score < 85 ? score + 4 : score;
  return { ...result, score: clamp(boosted, 0, 96) };
}

function buildProperAnswerFromProfile(question: string, profile: InterviewProfile) {
  const skill = profile.skills.slice(0, 3).join(', ') || 'my core skills';
  const experience =
    profile.experiences.find((item) => !/^Project:/i.test(item)) ||
    profile.experiences[0] ||
    '';
  const project = profile.experiences.find((item) => /^Project:/i.test(item));
  const role = profile.jobRole || 'this role';
  const parts = [
    `For this question, a strong answer would sound like:`,
    `I am preparing for ${role} opportunities`,
    profile.experienceYears > 0
      ? `with about ${profile.experienceYears} year${profile.experienceYears === 1 ? '' : 's'} of relevant exposure`
      : 'and I have built practical skills through projects and learning',
    `. My key skills include ${skill}.`,
  ];
  if (experience) {
    parts.push(` From my background, ${experience.split('—')[0].trim()} taught me how to deliver work carefully and communicate clearly.`);
  } else if (project) {
    parts.push(` In ${project.replace(/^Project:\s*/i, '').split('—')[0].trim()}, I focused on solving a real problem end to end.`);
  }
  parts.push(` Related to the question — "${question.split(/[.?\n]/)[0]?.trim() || question.slice(0, 80)}" — I would explain my approach, the tools I used, and the outcome in simple terms.`);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

function sanitizeImproved(
  original: string,
  improved: string,
  profile: InterviewProfile,
  allowProfileSample = false,
) {
  if (!improved.trim() || isAudioPlaceholderAnswer(improved)) {
    return allowProfileSample ? buildProperAnswerFromProfile('', profile) : '';
  }
  if (isAudioPlaceholderAnswer(original) && !allowProfileSample) {
    return '';
  }
  const allowed = `${original} ${profile.fullName} ${profile.skills.join(' ')} ${profile.experiences.join(' ')} ${profile.summary} ${profile.jobRole}`.toLowerCase();
  if (/\d{2,}/.test(improved) && !/\d{2,}/.test(original) && !allowed.match(/\d{2,}/) && !allowProfileSample) {
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
    items.push(`You answered ${answeredCount} of ${totalPlanned} planned questions`);
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
