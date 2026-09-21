/**
 * Local verification for question-type-aware evaluation + improved answers.
 * Run: npx tsx src/interviews/interview-evaluation.util.test.ts
 */
import {
  answersTooSimilar,
  buildCategoryAwareImprovedAnswer,
  classifyQuestionType,
  localAnalyzeCategoryAware,
  needsStrongRewrite,
} from './interview-evaluation.util';

const profile = {
  fullName: 'Rakshita Sharma',
  jobRole: 'Software Developer',
  skills: ['Python', 'Java', 'C++', 'Machine Learning'],
  education: ['B.E. Information Science and Engineering — IIT Hassan'],
  experiences: [
    'Project: Adaptive Replenishment Framework for Traffic Recognition — ML pipeline and evaluation',
    'Internship: AI-based fraud detection — applied ML to a real-world problem',
  ],
  summary: 'Aspiring software developer with ML project experience.',
  experienceYears: 0,
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function runCase(name: string, question: string, answer: string, expectedType: string) {
  const type = classifyQuestionType(question);
  assert(type === expectedType, `${name}: expected type ${expectedType}, got ${type}`);
  const result = localAnalyzeCategoryAware(question, answer, profile);
  assert(!!result.whatWasMissing?.length, `${name}: expected whatWasMissing`);
  assert(!!result.improvementSuggestion, `${name}: expected improvement tip`);
  assert(!!result.improvedAnswer && result.improvedAnswer.length > answer.length * 0.8, `${name}: improved answer too short`);
  assert(
    needsStrongRewrite(result.score, result.whatWasMissing, answer, answer),
    `${name}: identical answer should need rewrite`,
  );
  assert(
    !answersTooSimilar(answer, result.improvedAnswer || ''),
    `${name}: improved answer is too similar to original`,
  );
  // Tip should not blindly say STAR for intro
  if (expectedType === 'INTRO') {
    assert(!/use star/i.test(result.improvementSuggestion), `${name}: INTRO tip should not force STAR`);
  }
  console.log(`PASS ${name}`);
  console.log(`  type=${type} score=${result.score}`);
  console.log(`  missing=${JSON.stringify(result.whatWasMissing)}`);
  console.log(`  tip=${result.improvementSuggestion}`);
  console.log(`  improved=${result.improvedAnswer?.slice(0, 180)}...`);
  console.log('');
}

runCase(
  'Tell me about yourself',
  'Tell me about yourself.',
  'Hi I am Rakshita. I completed Information Science and Engineering. I know Python Java C++. I worked on machine learning projects and completed an internship where I worked on an AI project.',
  'INTRO',
);

runCase(
  'Project question',
  'Tell me about a project you built and your contribution.',
  'I worked on a machine learning project and used Python. It was good.',
  'PROJECT',
);

runCase(
  'Technical question',
  'What is the difference between a list and a tuple in Python?',
  'List and tuple are both used to store data in Python.',
  'TECHNICAL',
);

// Sanity: strong answer should not be forced into a wild rewrite similarity check failure path wrongly
{
  const strong =
    'Hi, I am Rakshita. I completed Information Science and Engineering from IIT Hassan. My strongest skills are Python, Java, and C++. In my Adaptive Replenishment Framework project I owned the ML evaluation pipeline. I also interned on an AI fraud detection project. I am looking for a Software Developer role where I can grow.';
  const improved = buildCategoryAwareImprovedAnswer(
    'Tell me about yourself.',
    strong,
    profile,
    'INTRO',
    [],
  );
  assert(improved.length > 40, 'strong path improved empty');
  console.log('PASS strong-answer builder still returns structured intro');
}

console.log('All interview evaluation checks passed.');
