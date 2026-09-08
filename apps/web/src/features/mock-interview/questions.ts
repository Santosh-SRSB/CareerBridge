const GENERAL_QUESTIONS = [
  'Tell me about yourself.',
  'Why do you want this job?',
  'What are your strengths?',
  'Describe a challenge you faced and how you handled it.',
  'Where do you see yourself in two years?',
  'Why should we hire you?',
  'How do you handle pressure at work?',
  'Tell me about a time you worked in a team.',
  'What motivates you at work?',
  'Do you have any questions for us?',
];

const ROLE_QUESTIONS: Record<string, string[]> = {
  'Customer Service Executive': [
    'Tell me about a time when you handled a difficult customer.',
    'How do you stay calm when a customer is angry?',
    'Describe your experience with phone or chat support.',
    'How do you prioritize multiple customer requests?',
    'What does good customer service mean to you?',
    'Tell me about a time you went the extra mile for a customer.',
    'How do you handle a situation when you do not know the answer?',
    'Describe a time you received positive feedback from a customer.',
  ],
  'Front Office Executive': [
    'How do you manage visitors at a busy front desk?',
    'Describe your experience with scheduling and coordination.',
    'How do you handle confidential information?',
    'Tell me about a time you solved an office coordination problem.',
  ],
  'Retail Associate': [
    'How do you help customers choose the right product?',
    'Describe a time you met a sales target.',
    'How do you handle long queues during peak hours?',
    'What would you do if a customer wanted a refund?',
  ],
  'Sales Executive': [
    'Tell me about a deal you closed successfully.',
    'How do you handle rejection from prospects?',
    'Describe your approach to finding new leads.',
    'How do you build trust with a new client?',
  ],
};

export function buildMockInterviewQuestions(
  jobRole: string,
  interviewType: 'GENERAL' | 'ROLE',
  count: number,
): string[] {
  const roleQuestions = ROLE_QUESTIONS[jobRole] || ROLE_QUESTIONS['Customer Service Executive'];
  const pool =
    interviewType === 'ROLE'
      ? [...roleQuestions, ...GENERAL_QUESTIONS.slice(0, 3)]
      : [...GENERAL_QUESTIONS, ...roleQuestions.slice(0, 3)];

  const unique = Array.from(new Set(pool));
  return unique.slice(0, Math.max(1, Math.min(count, unique.length)));
}
