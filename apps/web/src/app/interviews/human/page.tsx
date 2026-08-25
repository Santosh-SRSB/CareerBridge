import Link from 'next/link';
import { CandidateShell } from '@/components/CandidatePortal';

export default function HumanInterviewPage() {
  return (
    <CandidateShell>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal">Human mock interview</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Practise with a real mentor</h1>
      <p className="mt-3 max-w-xl text-muted">
        A human interviewer will soon join you on a live call, review your Career Passport, and give spoken feedback. This path is not open yet.
      </p>
      <div className="cb-dash-card mt-6 max-w-lg p-5">
        <p className="font-bold text-primary">Meanwhile</p>
        <p className="mt-2 text-sm text-muted">Use AI Live Interview with your passport or a dropped resume. You can quit anytime and still get a scored report.</p>
        <Link href="/interviews/ai" className="mt-4 inline-flex font-bold text-teal hover:underline">
          Start AI Based Mock Interview →
        </Link>
      </div>
    </CandidateShell>
  );
}
