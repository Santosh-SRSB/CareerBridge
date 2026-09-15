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
  ): Promise<{
    analysis: string;
    improvedAnswer?: string;
    strengths: string[];
    weaknesses: string[];
    whatWasGood?: string[];
    whatWasMissing?: string[];
    improvementSuggestion?: string;
    score: number;
  }> {
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
        whatWasGood: [] as string[],
        whatWasMissing: ['A professional answer to the question'],
        improvementSuggestion: 'Rewrite the answer professionally and address the question directly.',
        score: 0,
      };
    }
    if (conduct === 'nonsense') {
      return {
        analysis: 'This response was not a meaningful answer to the interview question.',
        improvedAnswer: buildProperAnswerFromProfile(question, profile),
        strengths: [] as string[],
        weaknesses: ['Answer was meaningless or too vague'],
        whatWasGood: [] as string[],
        whatWasMissing: ['A clear, relevant answer to the question'],
        improvementSuggestion: 'Answer the question in plain language with at least a few concrete sentences.',
        score: 25,
      };
    }

    if (!this.aiGateway.isConfigured()) {
      return calibrateScore(localAnalyze(question, text, profile), text);
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
      { temperature: 0.2 },
    );
    const local = localAnalyze(question, text, profile);
    if (!fromAi) return calibrateScore(local);
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const improvedAnswer =
      sanitizeImproved(text, fromAi.improvedAnswer || '', profile, wordCount < 8) ||
      (wordCount < 8 ? buildProperAnswerFromProfile(question, profile) : improveLocal(text, profile));
    const analysisParts = [
      fromAi.analysis || local.analysis,
      fromAi.improvementSuggestion
        ? `Next step: ${fromAi.improvementSuggestion}`
        : '',
    ].filter(Boolean);
    return calibrateScore({
      analysis: analysisParts.join(' '),
      improvedAnswer: improvedAnswer || undefined,
      strengths: fromAi.strengths?.length
        ? fromAi.strengths.slice(0, 4)
        : fromAi.whatWasGood?.length
          ? fromAi.whatWasGood.slice(0, 4)
          : local.strengths,
      weaknesses: fromAi.weaknesses?.length
        ? fromAi.weaknesses.slice(0, 4)
        : fromAi.whatWasMissing?.length
          ? fromAi.whatWasMissing.slice(0, 4)
          : local.weaknesses,
      whatWasGood: (fromAi.whatWasGood || fromAi.strengths || local.strengths).slice(0, 4),
      whatWasMissing: (fromAi.whatWasMissing || fromAi.weaknesses || local.weaknesses).slice(0, 4),
      improvementSuggestion:
        fromAi.improvementSuggestion ||
        local.weaknesses[0] ||
        'Add specific examples that directly answer each part of the question.',
      score: clamp(fromAi.score ?? local.score, 0, 100),
    }, text);
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
    const technicalKnowledge = scoreByCategories(answered, /TECHNICAL|PROJECT|EDUCATION|EXPERIENCE|RESUME/i);
    const problemSolving = scoreByCategories(answered, /SCENARIO|PROBLEM|FOLLOW_UP/i);
    const roleReadiness = scoreRoleReadiness(answered, communication, technicalKnowledge, overall);
    const hasAudioAnswers = answered.some((item) => item.answerMode === 'AUDIO');
    const confidence = hasAudioAnswers
      ? scoreConfidenceFromAudio(answered)
      : null;
    const confidenceNote = hasAudioAnswers
      ? null
      : 'Confidence cannot be reliably measured from text answers alone.';

    const fromAi = await this.askJson<{
      summary?: string;
      overallAnalysis?: string;
      strengths?: string[];
      weaknesses?: string[];
      dos?: string[];
      donts?: string[];
      recommendation?: string;
      postInterviewSuggestions?: InterviewReport['postInterviewSuggestions'];
    }>(
      [
        'You are an expert interview evaluator summarizing a completed interview.',
        'Be accurate and fair. Do NOT inflate praise. Do not invent experience.',
        'overallAnalysis must explain why the overall score is what it is, based on actual answer quality.',
        'strengths and weaknesses must be specific (not "completed the interview").',
        'postInterviewSuggestions must be personalized to THIS candidate weaknesses: communication[], technical[], answerStructure[], topicsToRevise[], practicePlan[].',
        'recommendation must match score bands: 85-100 Strongly Recommended; 70-84 Recommended; 55-69 Needs Improvement; 40-54 Significant Improvement Needed; 0-39 Not Recommended.',
        'Return JSON { summary, overallAnalysis, strengths, weaknesses, dos, donts, recommendation, postInterviewSuggestions }.',
      ].join(' '),
      JSON.stringify({
        profile: {
          fullName: profile.fullName,
          jobRole: profile.jobRole,
          skills: profile.skills.slice(0, 12),
          experienceYears: profile.experienceYears,
        },
        durationSec,
        warningCounts,
        answeredCount,
        totalPlanned,
        overallScore: overall,
        overallOutOf10,
        perQuestionAvgOutOf10: overallOutOf10,
        questions: answered.map((item) => ({
          question: item.text,
          category: item.category,
          answer: item.answer,
          score: item.score,
          scoreOutOf10: Math.max(0, Math.min(10, Math.round((item.score || 0) / 10))),
          analysis: item.analysis,
          whatWasMissing: item.whatWasMissing,
          weaknesses: item.weaknesses,
        })),
      }),
    );
    const baseSummary =
      answeredCount === 0
        ? `No answers were submitted out of ${totalPlanned} planned questions.`
        : `You answered ${answeredCount} of ${totalPlanned} questions. Overall score ${overallOutOf10}/10 (${overall}/100) is the average of your per-question scores.`;
    const integrityNote =
      (warningCounts.abuseWarnings || 0) > 0
        ? ` Integrity: ${warningCounts.abuseWarnings} abuse warning(s) were recorded — recommendation cannot be positive.`
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
    const postInterviewSuggestions =
      fromAi?.postInterviewSuggestions ||
      defaultPostInterviewSuggestions(answered, profile, overall);

    return {
      overallScore: overall,
      communication,
      behaviour,
      listening,
      technicalKnowledge,
      problemSolving,
      roleReadiness,
      confidence,
      confidenceNote,
      recommendation,
      summary: fromAi?.summary ? `${baseSummary} ${fromAi.summary}${integrityNote}` : `${baseSummary}${integrityNote}`,
      overallAnalysis:
        fromAi?.overallAnalysis ||
        `Average per-question quality is ${overallOutOf10}/10. Scores reflect demonstrated answer depth, not merely completing the interview.`,
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
      postInterviewSuggestions,
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
      ? 'You submitted an audio answer without usable transcript text, so content quality could not be fully verified. Score reflects attempt length only — not demonstrated technical depth.'
      : 'Your audio answer was too short to evaluate content quality.',
    improvedAnswer: '',
    strengths: spokeLongEnough ? ['Attempted a spoken answer'] : [],
    weaknesses: spokeLongEnough
      ? ['Content could not be verified from text — practice clearer speech for scoring']
      : ['Answer was too short to evaluate'],
    whatWasGood: spokeLongEnough ? ['Attempted a spoken answer'] : [],
    whatWasMissing: ['Clear spoken content that can be evaluated against the question'],
    improvementSuggestion:
      'Speak for 45–90 seconds and cover the question’s key points with a concrete example.',
    score: spokeLongEnough ? 35 : 25,
  };
}

function localAnalyze(question: string, answer: string, profile: InterviewProfile) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const relevant = overlap(answer, `${question} ${profile.skills.join(' ')} ${profile.jobRole}`);
  // Strict local fallback: short answers stay low; length alone cannot reach “excellent”.
  let score = 15 + Math.min(25, words.length) + Math.min(20, relevant * 3);
  if (words.length < 8) score = Math.min(score, 28);
  else if (words.length < 20) score = Math.min(score, 45);
  else if (words.length < 40) score = Math.min(score, 62);
  else score = Math.min(score, 78);
  score = clamp(score, 0, 78);
  const improved = improveLocal(answer, profile);
  const questionHint = question.split(/[.?\n]/).find((line) => line.trim().length > 12)?.trim() || question.slice(0, 80);
  const whatWasMissing =
    words.length < 20
      ? [
          'Enough detail to cover the question’s key points',
          'A concrete example from your real experience',
          'Clear personal contribution / tools used when asked',
        ]
      : [
          'Stronger structure (situation → action → result)',
          'More specific outcomes or technical detail',
        ];
  return {
    analysis:
      words.length < 20
        ? `For "${questionHint}", your answer was too brief and incomplete. You did not cover enough of what the question asked.`
        : `For "${questionHint}", you made some relevant points but need more depth and structure for a stronger score.`,
    improvedAnswer: improved || undefined,
    strengths:
      words.length >= 20
        ? ['Attempted a relevant response', relevant ? 'Stayed related to the topic' : 'Stayed professional']
        : words.length >= 5
          ? ['Attempted the question']
          : [],
    weaknesses: whatWasMissing.slice(0, 3),
    whatWasGood:
      words.length >= 20
        ? ['Provided a related response']
        : words.length >= 5
          ? ['Attempted the question']
          : [],
    whatWasMissing,
    improvementSuggestion:
      words.length < 20
        ? 'Aim for 4–6 sentences: answer each part of the question, add one real example, and state your contribution or tools when relevant.'
        : 'Use STAR (Situation → Task → Action → Result) and add one specific technical or project detail.',
    score,
  };
}

function improveLocal(answer: string, profile: InterviewProfile) {
  const clean = answer.replace(/\s+/g, ' ').trim();
  if (!clean || isAudioPlaceholderAnswer(clean)) return '';
  // Only polish grammar/structure — do NOT inject unrelated profile skills.
  let improved = `${clean.charAt(0).toUpperCase()}${clean.slice(1)}${clean.endsWith('.') ? '' : '.'}`;
  if (improved.length < 40 && profile.jobRole && clean.toLowerCase().includes(profile.jobRole.toLowerCase())) {
    improved += ` I am preparing carefully for ${profile.jobRole} interviews.`;
  }
  return improved.trim();
}

/** Cap inflated scores for very short answers; never boost. */
function calibrateScore<T extends { score: number }>(result: T, answerText = ''): T {
  const score = result.score;
  if (score <= 0) return result;
  const words = answerText.trim().split(/\s+/).filter(Boolean).length;
  let next = score;
  if (words > 0 && words < 8) next = Math.min(next, 32);
  else if (words > 0 && words < 15) next = Math.min(next, 48);
  else if (words > 0 && words < 25) next = Math.min(next, 65);
  return { ...result, score: clamp(next, 0, 100) };
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
  const avgWords =
    textAnswers.reduce((sum, item) => sum + item.split(/\s+/).length, 0) / textAnswers.length;
  const avgScore =
    questions.reduce((sum, item) => sum + (item.score || 0), 0) / Math.max(questions.length, 1);
  // Blend content quality with clarity/length — do not reward length alone.
  const lengthPart = clamp(Math.round(2 + Math.min(4, avgWords / 25)), 2, 6);
  const qualityPart = clamp(Math.round(avgScore / 20), 1, 5);
  return clamp(lengthPart + qualityPart - 1, 1, 10);
}

function scoreByCategories(questions: LiveInterviewQuestion[], pattern: RegExp): number | null {
  const matched = questions.filter(
    (item) => item.score != null && pattern.test(item.category || ''),
  );
  if (matched.length < 1) return null;
  const avg =
    matched.reduce((sum, item) => sum + (item.score || 0), 0) / matched.length;
  return clamp(Math.round(avg / 10), 1, 10);
}

function scoreRoleReadiness(
  questions: LiveInterviewQuestion[],
  communication: number,
  technical: number | null,
  overall: number,
) {
  const roleQs = questions.filter((item) =>
    /ROLE|INTRO|EXPERIENCE|BEHAVIOURAL/i.test(item.category || ''),
  );
  const roleAvg = roleQs.length
    ? roleQs.reduce((sum, item) => sum + (item.score || 0), 0) / roleQs.length / 10
    : overall / 10;
  const tech = technical ?? Math.round(overall / 12);
  return clamp(Math.round((roleAvg + communication + tech) / 3), 1, 10);
}

function scoreConfidenceFromAudio(questions: LiveInterviewQuestion[]) {
  const audio = questions.filter((item) => item.answerMode === 'AUDIO');
  if (!audio.length) return null;
  const avgDur =
    audio.reduce((sum, item) => sum + (item.answerDurationSec || 0), 0) / audio.length;
  const avgScore = audio.reduce((sum, item) => sum + (item.score || 0), 0) / audio.length;
  // Duration + content quality proxy only — not a true vocal confidence metric.
  const durationPart = avgDur >= 45 ? 4 : avgDur >= 20 ? 3 : 2;
  const qualityPart = clamp(Math.round(avgScore / 25), 1, 4);
  return clamp(durationPart + qualityPart, 1, 8);
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

  if (abuse >= 3) return 1;
  if (abuse >= 2) return 2;
  if (abuse >= 1) return 3;

  const rude = questions.some((item) => /stupid|hate|idk lol|whatever|shut up/i.test(item.answer || ''));
  const complete = questions.filter((item) => (item.answer || '').split(/\s+/).filter(Boolean).length >= 25).length / questions.length;
  let base = clamp(Math.round((rude ? 3 : 6) + complete * 3), 1, 10);
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
  const allowed = [
    'Strongly Recommended',
    'Recommended',
    'Needs Improvement',
    'Significant Improvement Needed',
    'Not Recommended',
    'Not Ready',
  ] as const;
  let pick: InterviewReport['recommendation'] =
    score >= 85
      ? 'Strongly Recommended'
      : score >= 70
        ? 'Recommended'
        : score >= 55
          ? 'Needs Improvement'
          : score >= 40
            ? 'Significant Improvement Needed'
            : 'Not Recommended';
  if (answeredCount < Math.ceil(totalPlanned * 0.4)) pick = 'Not Recommended';
  else if (answeredCount < Math.ceil(totalPlanned * 0.6) && pick === 'Strongly Recommended') {
    pick = 'Recommended';
  }
  if ((integrity?.abuseWarnings || 0) >= 1) pick = 'Not Ready';
  if ((integrity?.faceMissing || 0) >= 3 && pick === 'Strongly Recommended') {
    pick = 'Needs Improvement';
  }
  if (raw && (allowed as readonly string[]).includes(raw)) {
    if ((integrity?.abuseWarnings || 0) >= 1) return 'Not Ready';
    // Never accept a model recommendation higher than the score band allows.
    const model = raw as InterviewReport['recommendation'];
    const rank = (r: InterviewReport['recommendation']) =>
      r === 'Strongly Recommended'
        ? 5
        : r === 'Recommended'
          ? 4
          : r === 'Needs Improvement'
            ? 3
            : r === 'Significant Improvement Needed'
              ? 2
              : 1;
    return rank(model) <= rank(pick) ? model : pick;
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
  const strong = questions.filter((item) => (item.score || 0) >= 70);
  if (strong.length) {
    return strong
      .slice(0, 3)
      .map((item) => `Answered with useful detail on: ${item.text.slice(0, 60)}${item.text.length > 60 ? '…' : ''}`);
  }
  const decent = questions.filter((item) => (item.score || 0) >= 50);
  if (decent.length) {
    return ['Showed willingness to answer each question', 'Stayed on topic for at least some responses'];
  }
  return questions.length
    ? ['Attempted the interview questions']
    : ['Started the interview'];
}

function defaultWeaknesses(questions: LiveInterviewQuestion[], answeredCount = 0, totalPlanned = 15) {
  const items: string[] = [];
  if (answeredCount < totalPlanned) {
    items.push(`You answered ${answeredCount} of ${totalPlanned} planned questions`);
  }
  const shortCount = questions.filter((item) => (item.answer || '').split(/\s+/).filter(Boolean).length < 20).length;
  if (shortCount > 0) {
    items.push(
      `${shortCount} answer${shortCount === 1 ? ' was' : 's were'} too short — cover key points with concrete examples`,
    );
  } else {
    items.push('Project/technical answers need clearer personal contribution and tools used');
  }
  items.push('Avoid generic statements; explain why your experience matches the question');
  return items;
}

function defaultPostInterviewSuggestions(
  questions: LiveInterviewQuestion[],
  profile: InterviewProfile,
  overall: number,
): NonNullable<InterviewReport['postInterviewSuggestions']> {
  const shortHeavy = questions.filter((item) => (item.answer || '').split(/\s+/).filter(Boolean).length < 20).length;
  const role = profile.jobRole || 'your target role';
  return {
    communication: [
      shortHeavy
        ? 'Your biggest gap was answer completeness. Aim for 45–90 seconds / 4–6 sentences per question.'
        : 'Tighten openings: state the direct answer in the first sentence, then support with an example.',
      'Practice aloud without reading a script so delivery stays natural.',
    ],
    technical: [
      `Revise fundamentals for ${role}: definitions, how it works, one practical example, and where you used it.`,
      'When asked about a tool/language, explain usage on a real task — not only that you “used it for programming”.',
    ],
    answerStructure: [
      'Behavioral/project: Situation → Task → Action (your contribution) → Result.',
      'Technical: Definition → How it works → Example → Practical usage.',
      'Project: Purpose → Your contribution → Technologies → Implementation → Challenge → Result.',
    ],
    topicsToRevise:
      profile.skills.slice(0, 5).length > 0
        ? profile.skills.slice(0, 5).map((skill) => `Be ready to explain ${skill} with a real example from your work/projects.`)
        : ['Core concepts for your target role', 'One project end-to-end narrative', 'Basics of APIs, databases, and debugging'],
    practicePlan: [
      overall < 55
        ? 'Re-do this mock focusing on longer answers for the first 3 question types you scored lowest on.'
        : 'Do one timed mock weekly and rewrite each weak answer using STAR before the next attempt.',
      'Record yourself once, then check: Did I answer every part of the question? Did I give an example?',
    ],
  };
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
