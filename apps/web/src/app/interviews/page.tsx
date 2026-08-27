'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CandidateShell } from '@/components/CandidatePortal';

export default function InterviewsHubPage() {
  const router = useRouter();

  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Practice interview</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Choose how you want to practise</h1>
      <p className="mt-2 max-w-2xl text-muted">
        AI Live Interview uses your Career Passport or a dropped resume. Human mock interview is a mentor session.
      </p>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <button type="button" className="cb-interview-choice is-ai" onClick={() => router.push('/interviews/ai')}>
          <span className="cb-interview-choice-photo">
            <Image src="/interviews/ai-orb.png" alt="" fill className="object-contain p-4" sizes="(max-width: 768px) 100vw, 400px" />
          </span>
          <span className="cb-interview-choice-kicker">Live · Voice · Camera</span>
          <strong>AI Based Mock Interview</strong>
          <p>Enter a full AI interview room. Adaptive questions from your profile, live transcript, then a report if you quit or finish.</p>
        </button>
        <button type="button" className="cb-interview-choice is-human" onClick={() => router.push('/interviews/human')}>
          <span className="cb-interview-choice-photo">
            <Image
              src="/interviews/ai-interviewer-live.png"
              alt=""
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 100vw, 400px"
            />
          </span>
          <span className="cb-interview-choice-kicker">Mentor</span>
          <strong>Human Based Mock Interview</strong>
          <p>Practise with a real interviewer. This path is opening next — you can still use AI Live Interview today.</p>
        </button>
      </div>
    </CandidateShell>
  );
}
