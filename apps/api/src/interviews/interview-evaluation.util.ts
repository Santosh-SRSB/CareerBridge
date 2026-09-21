export type ProfileFacts = {
  fullName: string;
  skills: string[];
  education: string[];
  experiences: string[];
  summary?: string;
  jobRole: string;
  experienceYears?: number;
};

export type InterviewQuestionType =
  | 'INTRO'
  | 'PROJECT'
  | 'TECHNICAL'
  | 'CODING'
  | 'BEHAVIOURAL'
  | 'SITUATIONAL'
  | 'EXPERIENCE'
  | 'SYSTEM_DESIGN'
  | 'HR'
  | 'FOLLOW_UP'
  | 'GENERAL';

export function classifyQuestionType(question: string): InterviewQuestionType {
  const q = question.toLowerCase();
  if (
    /tell me about yourself|introduce yourself|walk me through your (background|resume|cv)|who are you|brief introduction/.test(
      q,
    )
  ) {
    return 'INTRO';
  }
  if (/follow[- ]?up|can you elaborate|go deeper|more detail|what happened next/.test(q)) {
    return 'FOLLOW_UP';
  }
  if (
    /system design|architecture|design a|high[- ]level design|scalability|how would you design/.test(q)
  ) {
    return 'SYSTEM_DESIGN';
  }
  if (
    /write (a |the )?code|pseudocode|algorithm|time complexity|space complexity|leetcode|implement |debug |edge case/.test(
      q,
    )
  ) {
    return 'CODING';
  }
  if (
    /project|built|developed|your contribution|tech stack|what did you (build|work on)|describe .+ project/.test(
      q,
    )
  ) {
    return 'PROJECT';
  }
  if (
    /tell me about a time|conflict|challenge you faced|how did you handle|leadership|teamwork|failed|mistake/.test(
      q,
    )
  ) {
    return 'BEHAVIOURAL';
  }
  if (/what would you do if|scenario|suppose |imagine |situational/.test(q)) {
    return 'SITUATIONAL';
  }
  if (/experience|internship|previous role|your job|responsibilities at/.test(q)) {
    return 'EXPERIENCE';
  }
  if (
    /explain |what is |difference between|how does |concept|oop|api|database|react|node|python|java|sql/.test(
      q,
    )
  ) {
    return 'TECHNICAL';
  }
  if (/salary|why (do you want|should we hire)|strengths|weaknesses|relocate|notice period/.test(q)) {
    return 'HR';
  }
  return 'GENERAL';
}

export function evaluationCriteriaFor(type: InterviewQuestionType): string[] {
  switch (type) {
    case 'INTRO':
      return [
        'Clear introduction (name + current focus)',
        'Education/background',
        'Relevant technical skills',
        'Relevant experience or projects with contribution',
        'Career objective tied to the role',
        'Structure and clarity',
        'Conciseness (roughly 45–90 seconds spoken)',
      ];
    case 'PROJECT':
      return [
        'What the project does / problem solved',
        'Candidate role and concrete contribution',
        'Technologies used',
        'Architecture or workflow at a high level',
        'Challenges and how they were handled',
        'Results or learning (only if real)',
      ];
    case 'TECHNICAL':
      return [
        'Correctness of the concept',
        'Clarity of explanation',
        'Appropriate depth for the question',
        'Simple example when helpful',
      ];
    case 'CODING':
      return [
        'Clear approach before diving into details',
        'Correctness of logic',
        'Complexity awareness when relevant',
        'Edge cases',
        'Ability to explain trade-offs',
      ];
    case 'BEHAVIOURAL':
      return [
        'Situation context',
        'Task or goal',
        'Actions the candidate took',
        'Result or learning',
        'Relevance to the role',
      ];
    case 'SITUATIONAL':
      return [
        'Understands the scenario',
        'Prioritizes thoughtfully',
        'Practical steps',
        'Communication / stakeholder awareness',
      ];
    case 'EXPERIENCE':
      return [
        'Role and responsibilities',
        'Tools and workflows used',
        'Concrete contribution',
        'What was learned',
      ];
    case 'SYSTEM_DESIGN':
      return [
        'Requirements clarification',
        'High-level components',
        'Data / API flow',
        'Trade-offs and bottlenecks',
      ];
    case 'HR':
      return ['Honesty', 'Motivation clarity', 'Role fit', 'Professional tone'];
    case 'FOLLOW_UP':
      return ['Directly addresses the follow-up', 'Adds new detail beyond the prior answer', 'Stays on topic'];
    default:
      return ['Relevance', 'Clarity', 'Specificity', 'Structure'];
  }
}

/** True when improved text is basically a paraphrase/copy of the original. */
export function answersTooSimilar(original: string, improved: string): boolean {
  const a = normalizeWords(original);
  const b = normalizeWords(improved);
  if (!b.length) return true;
  if (a.join(' ') === b.join(' ')) return true;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const w of setA) if (setB.has(w)) inter += 1;
  const union = new Set([...setA, ...setB]).size || 1;
  const jaccard = inter / union;
  const lenRatio =
    Math.min(original.trim().length, improved.trim().length) /
    Math.max(original.trim().length, improved.trim().length, 1);
  // Near-copy: high overlap and similar length.
  if (jaccard >= 0.78 && lenRatio >= 0.75) return true;
  // Tiny edit (grammar only).
  if (jaccard >= 0.9) return true;
  return false;
}

export function needsStrongRewrite(
  score: number,
  whatWasMissing: string[],
  original: string,
  improved: string,
): boolean {
  const weak = score < 72 || whatWasMissing.length > 0;
  if (!weak) return false;
  return answersTooSimilar(original, improved) || !improved.trim();
}

/**
 * Profile-aware improved answer that restructures the candidate's facts.
 * Never invents employers, metrics, tools, or achievements not present in profile/answer.
 */
export function buildCategoryAwareImprovedAnswer(
  question: string,
  originalAnswer: string,
  profile: ProfileFacts,
  type: InterviewQuestionType,
  whatWasMissing: string[] = [],
): string {
  const name = firstName(profile.fullName);
  const skills = profile.skills.slice(0, 6);
  const education = profile.education[0] || '';
  const projectLine =
    profile.experiences.find((item) => /^Project:/i.test(item)) ||
    profile.experiences.find((item) => /project/i.test(item)) ||
    '';
  const workLine =
    profile.experiences.find((item) => !/^Project:/i.test(item)) || profile.experiences[0] || '';
  const role = profile.jobRole || 'software development';
  const fromAnswer = extractUsefulPhrases(originalAnswer);

  switch (type) {
    case 'INTRO': {
      const parts: string[] = [];
      parts.push(
        name
          ? `Hi, I'm ${name}.`
          : 'Hi — thanks for having me.',
      );
      if (education) {
        parts.push(`I completed ${stripLabel(education)}.`);
      } else if (fromAnswer.educationHint) {
        parts.push(fromAnswer.educationHint);
      }
      if (skills.length) {
        parts.push(`My strongest technical skills include ${joinNatural(skills)}.`);
      } else if (fromAnswer.skillsHint) {
        parts.push(fromAnswer.skillsHint);
      }
      if (projectLine) {
        parts.push(
          `During my academic work, I worked on ${stripLabel(projectLine.replace(/^Project:\s*/i, ''))}, where I focused on building and iterating on a real problem end to end.`,
        );
      } else if (fromAnswer.projectHint) {
        parts.push(fromAnswer.projectHint);
      }
      if (workLine && workLine !== projectLine) {
        parts.push(
          `I also gained practical exposure through ${stripLabel(workLine)}, which helped me apply what I learned in a real-world setting.`,
        );
      } else if (fromAnswer.internshipHint) {
        parts.push(fromAnswer.internshipHint);
      }
      parts.push(
        `I'm now looking for a ${role} opportunity where I can use my programming and problem-solving skills while continuing to grow.`,
      );
      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }
    case 'PROJECT': {
      const project = stripLabel(projectLine.replace(/^Project:\s*/i, '')) || fromAnswer.projectHint || 'a project from my background';
      const tech = skills.length ? joinNatural(skills.slice(0, 4)) : fromAnswer.skillsHint || 'the tools I already know';
      return [
        `In ${project}, the goal was to solve a practical problem for users.`,
        `My role was hands-on implementation: I worked with ${tech} and owned key parts of the workflow from design through testing.`,
        `I focused on understanding requirements, implementing core features carefully, and validating that the solution worked end to end.`,
        whatWasMissing.some((m) => /challenge|problem/i.test(m))
          ? `When I hit blockers, I broke the problem down, checked documentation, and iterated until the feature was stable.`
          : `That experience taught me how to take ownership and explain technical decisions clearly.`,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    case 'TECHNICAL': {
      const topic = question
        .replace(/\?+$/, '')
        .trim()
        .replace(/^(what is|what's|explain|describe)\s+/i, '');
      return [
        `Here is how I understand ${topic}.`,
        originalAnswer.trim().length > 40
          ? `Building on what I said: ${cleanSentence(originalAnswer)}`
          : `I would start with the core idea in plain language, then give a small example.`,
        skills.length
          ? `In practice I have used related skills such as ${joinNatural(skills.slice(0, 3))} in my projects, so I try to connect the concept to how it shows up in real code.`
          : `I would connect the concept to a small example from my learning so the explanation stays concrete.`,
        `If helpful, I can also contrast it with a related idea or walk through a short example step by step.`,
      ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    case 'CODING': {
      return [
        `I would start by restating the problem and clarifying inputs, outputs, and edge cases.`,
        `Next I would outline an approach in plain language, then walk through the algorithm step by step.`,
        `I would mention time and space complexity at a high level and call out at least one edge case I would test.`,
        originalAnswer.trim().length > 20
          ? `From my attempt: ${cleanSentence(originalAnswer)}`
          : `If I get stuck, I would explain my reasoning out loud and refine the approach rather than guessing.`,
      ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    case 'BEHAVIOURAL':
    case 'SITUATIONAL': {
      const context = workLine || projectLine || fromAnswer.internshipHint || 'a recent project or internship';
      return [
        `Situation: In ${stripLabel(context)}, I faced a situation similar to what you asked.`,
        `Task: My goal was to unblock progress and keep the outcome reliable.`,
        `Action: I clarified the problem, broke it into smaller steps, used the skills I already have (${skills.slice(0, 3).join(', ') || 'my core skills'}), and communicated updates clearly.`,
        `Result: We moved forward with a clearer plan, and I learned to stay calm, structured, and specific under pressure.`,
      ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    case 'EXPERIENCE': {
      const exp = stripLabel(workLine) || fromAnswer.internshipHint || 'my recent experience';
      return [
        `In ${exp}, my responsibilities included contributing to day-to-day delivery and learning professional engineering practices.`,
        skills.length ? `I used ${joinNatural(skills.slice(0, 4))} where relevant.` : '',
        `What mattered most was taking ownership of my tasks, asking clarifying questions early, and making sure my work was tested before I shared it.`,
        `That experience connects directly to ${role} because it built the habits I would bring to your team.`,
      ]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    default: {
      const structured = [
        cleanSentence(originalAnswer),
        skills.length ? `I can also connect this to skills I already have, such as ${joinNatural(skills.slice(0, 3))}.` : '',
        education ? `My background in ${stripLabel(education)} helps me approach this thoughtfully.` : '',
        `I would keep the answer structured: direct response first, then one concrete example, then a short takeaway for ${role}.`,
      ]
        .filter(Boolean)
        .join(' ');
      return structured.replace(/\s+/g, ' ').trim();
    }
  }
}

export function localAnalyzeCategoryAware(
  question: string,
  answer: string,
  profile: ProfileFacts,
) {
  const type = classifyQuestionType(question);
  const criteria = evaluationCriteriaFor(type);
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const relevant = tokenOverlap(answer, `${question} ${profile.skills.join(' ')} ${profile.jobRole}`);

  let score = 18 + Math.min(22, words.length) + Math.min(18, relevant * 3);
  if (words.length < 8) score = Math.min(score, 28);
  else if (words.length < 20) score = Math.min(score, 45);
  else if (words.length < 40) score = Math.min(score, 62);
  else score = Math.min(score, 78);
  score = clamp(score, 0, 78);

  const whatWasMissing = missingForType(type, answer, profile, criteria);
  const tip = improvementTipFor(type, whatWasMissing);
  const improved = buildCategoryAwareImprovedAnswer(question, answer, profile, type, whatWasMissing);

  return {
    analysis:
      words.length < 20
        ? `For this ${labelType(type)} question, your answer was too brief and did not cover enough of what was asked.`
        : `For this ${labelType(type)} question, you made relevant points but the answer needs clearer structure and more specific detail.`,
    improvedAnswer: improved,
    strengths:
      words.length >= 20
        ? ['Attempted a relevant response', relevant ? 'Stayed related to the topic' : 'Stayed professional']
        : words.length >= 5
          ? ['Attempted the question']
          : [],
    weaknesses: whatWasMissing.slice(0, 4),
    whatWasGood:
      words.length >= 20
        ? ['Provided a related response']
        : words.length >= 5
          ? ['Attempted the question']
          : [],
    whatWasMissing,
    improvementSuggestion: tip,
    score,
    questionType: type,
  };
}

function missingForType(
  type: InterviewQuestionType,
  answer: string,
  profile: ProfileFacts,
  criteria: string[],
): string[] {
  const lower = answer.toLowerCase();
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const missing: string[] = [];

  if (type === 'INTRO') {
    if (!/\b(i am|i'm|my name)\b/i.test(answer) && !profile.fullName) {
      missing.push('A clear self-introduction at the start');
    }
    if (!/(bachelor|degree|engineering|graduat|stud(y|ied)|college|university)/i.test(answer) && !profile.education.length) {
      missing.push('A brief mention of your education/background');
    }
    if (!profile.skills.some((s) => lower.includes(s.toLowerCase())) && words < 40) {
      missing.push('Your strongest technical skills named clearly');
    }
    if (!/(project|internship|built|developed|worked on)/i.test(answer)) {
      missing.push('One relevant project or internship and your contribution');
    }
    if (!/(looking for|aspire|want to|opportunity|role|career)/i.test(answer)) {
      missing.push('A short closing that connects you to the role');
    }
    if (words >= 15 && missing.length === 0) {
      missing.push('Clearer structure: intro → education/skills → one project → role goal');
    }
  } else if (type === 'PROJECT') {
    if (!/(i |my role|responsible|owned|implemented|built)/i.test(answer)) {
      missing.push('Your specific role and contribution on the project');
    }
    if (!profile.skills.some((s) => lower.includes(s.toLowerCase()))) {
      missing.push('Technologies you actually used');
    }
    if (!/(problem|user|goal|challenge)/i.test(answer)) {
      missing.push('The problem the project solved');
    }
  } else if (type === 'TECHNICAL') {
    if (words < 25) missing.push('A clearer explanation of the core concept');
    if (!/(for example|example|such as|like )/i.test(answer)) {
      missing.push('A short example that shows you understand the idea');
    }
  } else if (type === 'BEHAVIOURAL' || type === 'SITUATIONAL') {
    if (!/(situation|when|during|at )/i.test(answer)) missing.push('A concrete situation/context');
    if (!/(i |we )/.test(lower)) missing.push('The actions you personally took');
    if (!/(result|outcome|learned|impact)/i.test(answer)) missing.push('The result or what you learned');
  } else if (type === 'CODING') {
    if (!/(approach|first|then|algorithm|complexity|edge)/i.test(answer)) {
      missing.push('A step-by-step approach before jumping to details');
    }
  } else if (words < 20) {
    missing.push(...criteria.slice(0, 3));
  } else {
    missing.push('More specific detail tied to the question');
    missing.push('Clearer structure so each part of the question is covered');
  }

  return missing.slice(0, 4);
}

function improvementTipFor(type: InterviewQuestionType, missing: string[]): string {
  if (type === 'INTRO') {
    return 'Start with your name and education, then name your strongest skills, briefly explain one relevant project and your contribution, and finish by connecting that experience to the role.';
  }
  if (type === 'BEHAVIOURAL' || type === 'SITUATIONAL') {
    return 'Use STAR only for this kind of question: Situation → Task → Action → Result, with actions that YOU took.';
  }
  if (type === 'PROJECT') {
    return 'Explain the problem, your role, the technologies, one technical decision or challenge, and what you personally delivered.';
  }
  if (type === 'TECHNICAL') {
    return 'Define the concept in one sentence, explain how it works, then give a tiny example — skip unrelated life-story details.';
  }
  if (type === 'CODING') {
    return 'State your approach, walk through the steps, mention complexity if relevant, and call out one edge case.';
  }
  if (missing[0]) {
    return `Focus on this first: ${missing[0].replace(/\.$/, '')}. Then add one concrete example from your real experience.`;
  }
  return 'Answer each part of the question directly, then add one real example from your background.';
}

function extractUsefulPhrases(answer: string) {
  const clean = answer.replace(/\s+/g, ' ').trim();
  const educationHint = clean.match(
    /(?:completed|studied|graduated|degree in|information science|engineering)[^.!]{0,80}/i,
  )?.[0];
  const skillsHint = clean.match(
    /(?:know|skills?|experienced in|worked with)\s+[^.!]{0,60}/i,
  )?.[0];
  const projectHint = clean.match(
    /(?:project|machine learning|built|developed)[^.!]{0,100}/i,
  )?.[0];
  const internshipHint = clean.match(/(?:internship|intern)[^.!]{0,100}/i)?.[0];
  return {
    educationHint: educationHint ? cleanSentence(educationHint) : '',
    skillsHint: skillsHint ? cleanSentence(skillsHint) : '',
    projectHint: projectHint ? cleanSentence(projectHint) : '',
    internshipHint: internshipHint ? cleanSentence(internshipHint) : '',
  };
}

function normalizeWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function tokenOverlap(a: string, b: string) {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'you', 'your', 'me', 'i', 'with']);
  const words = b
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((item) => item.length > 3 && !stop.has(item));
  return words.filter((item) => a.toLowerCase().includes(item)).length;
}

function firstName(fullName: string) {
  return (fullName || '').trim().split(/\s+/)[0] || '';
}

function joinNatural(items: string[]) {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function stripLabel(value: string) {
  return value.replace(/^[^:]+:\s*/, '').replace(/\s+/g, ' ').trim();
}

function cleanSentence(value: string) {
  const t = value.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const capped = `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

function labelType(type: InterviewQuestionType) {
  return type.replace(/_/g, ' ').toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
