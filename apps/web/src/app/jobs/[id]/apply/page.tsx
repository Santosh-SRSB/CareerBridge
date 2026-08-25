'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { JobDetail, ResumeRecord, ScreeningAnswer } from '@careerbridge/shared';
import { applyToJob, getJob, listResumes } from '@/lib/api';
import { CandidateShell } from '@/components/CandidatePortal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function ApplyPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [resumeId, setResumeId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getJob(params.id), listResumes().catch(() => [])])
      .then(([nextJob, nextResumes]) => {
        setJob(nextJob);
        setResumes(nextResumes);
        setResumeId(nextResumes[0]?.id || '');
      })
      .catch(() => setError('This job is no longer available.'));
  }, [params.id]);

  function setAnswer(questionId: string, answer: string) {
    setAnswers((current) => ({ ...current, [questionId]: answer }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!resumes.length) {
      router.push('/resume');
      return;
    }
    const questions = job?.screeningQuestions || [];
    for (const question of questions) {
      if (question.required === false) continue;
      if (!(answers[question.id] || '').trim()) {
        setError(`Please answer: ${question.prompt}`);
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const screeningAnswers: ScreeningAnswer[] = questions
        .map((question) => ({
          questionId: question.id,
          answer: (answers[question.id] || '').trim(),
        }))
        .filter((item) => item.answer);
      const application = await applyToJob(params.id, resumeId, screeningAnswers);
      router.replace(`/applications/${application.id}/confirmation`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not send your application right now.');
    } finally {
      setLoading(false);
    }
  }

  if (!job) {
    return (
      <CandidateShell>
        <p className="text-muted">Preparing your application...</p>
      </CandidateShell>
    );
  }

  const questions = job.screeningQuestions || [];

  return (
    <CandidateShell>
      <Link href={`/jobs/${job.id}`} className="text-sm font-bold text-teal hover:underline">
        ← Job details
      </Link>
      <h1 className="break-words text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">
        Apply for {job.title}
      </h1>
      <p className="mt-2 text-muted">
        {job.companyName} · {job.city}
      </p>
      <form onSubmit={onSubmit} className="cb-dash-card max-w-3xl space-y-5 p-4 sm:p-5">
        <div>
          <p className="font-bold text-primary">Before you apply</p>
          <ul className="mt-3 space-y-1 text-sm text-primary">
            <li>✓ Career Passport</li>
            <li>✓ Contact information</li>
            <li>{resumes.length ? '✓ Resume available' : '⚠ Create your first resume'}</li>
          </ul>
        </div>
        {resumes.length ? (
          <div>
            <p className="font-bold text-primary">Your resume</p>
            <div className="mt-3 space-y-2">
              {resumes.map((item) => (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 ${
                    resumeId === item.id ? 'border-primary bg-primary-soft' : 'border-primary/15'
                  }`}
                >
                  <input
                    type="radio"
                    name="resume"
                    checked={resumeId === item.id}
                    onChange={() => setResumeId(item.id)}
                  />
                  <span>
                    <span className="block font-bold text-primary">{item.title}</span>
                    <span className="text-sm text-muted">
                      Updated {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {resumeId ? (
              <Link
                href={`/resume/${resumeId}`}
                className="mt-3 inline-flex text-sm font-bold text-teal hover:underline"
              >
                Preview resume
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="text-muted">Your Career Passport is ready. Let&apos;s create your first resume.</p>
        )}

        {questions.length ? (
          <div className="space-y-4">
            <div>
              <p className="font-bold text-primary">Screening questions</p>
              <p className="mt-1 text-sm text-muted">
                Answer these must-have questions from the employer.
              </p>
            </div>
            {questions.map((question) => (
              <div key={question.id} className="rounded-md border border-primary/10 p-4">
                <p className="text-sm font-semibold text-primary">
                  {question.prompt}
                  {question.required === false ? '' : ' *'}
                </p>
                {question.type === 'YES_NO' ? (
                  <div className="mt-3 flex gap-2">
                    {['Yes', 'No'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAnswer(question.id, option)}
                        className={`rounded-pill border px-4 py-2 text-sm font-semibold ${
                          answers[question.id] === option
                            ? 'border-primary bg-primary text-accent'
                            : 'border-primary/20 text-primary'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
                {question.type === 'SINGLE_CHOICE' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(question.options || []).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setAnswer(question.id, option)}
                        className={`rounded-pill border px-4 py-2 text-sm font-semibold ${
                          answers[question.id] === option
                            ? 'border-primary bg-primary text-accent'
                            : 'border-primary/20 text-primary'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : null}
                {question.type === 'SHORT_TEXT' ? (
                  <div className="mt-3">
                    <Input
                      label="Your answer"
                      name={`answer-${question.id}`}
                      value={answers[question.id] || ''}
                      onChange={(event) => setAnswer(question.id, event.target.value)}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-error">{error}</p> : null}
        <Button type="submit" loading={loading} loadingLabel="Submitting...">
          {resumes.length ? 'Submit Application' : 'Create My Resume'}
        </Button>
      </form>
    </CandidateShell>
  );
}
