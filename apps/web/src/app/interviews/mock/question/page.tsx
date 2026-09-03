'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function MockInterviewQuestionPage() {
  const router = useRouter();
  const [answer, setAnswer] = useState('');
  const [recording, setRecording] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      router.push('/interviews/mock/results');
    }, 400);
  }

  function toggleRecord() {
    setRecording(!recording);
    if (!recording && !answer) {
      setAnswer('In my previous role, a customer was upset about a delayed delivery. I listened calmly without interrupting, acknowledged their frustration, checked the system immediately, and arranged a priority courier with a replacement.');
    }
  }

  return (
    <CandidateAppShell activeTab="interviews" showBack title="Question 2 of 5" maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Progress Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Interview in Progress: Question 2 of 5</span>
            <span>40% Completed</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-[#0a2e2c]" style={{ width: '40%' }} />
          </div>
        </div>

        {/* Question Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0d9488]">
              Interviewer Prompt
            </span>
            <div className="rounded-2xl bg-[#f4f1ea] p-5 text-sm sm:text-base font-bold text-slate-900 leading-relaxed border border-[#ebe5d8]">
              &quot;Tell me about a time you handled a difficult customer inquiry. What steps did you take to resolve it?&quot;
            </div>
          </div>

          {/* Answer Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">Your spoken or typed response</label>
              <span className="text-[11px] text-slate-400 font-mono">{answer.length} characters</span>
            </div>
            <textarea
              rows={6}
              placeholder="Click 'Record Answer' to speak using microphone, or type your response here..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
            />
          </div>

          {/* Action Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={toggleRecord}
              className={`w-full sm:w-auto px-6 py-3 text-xs font-bold border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2 ${
                recording ? 'bg-red-50 border-red-300 text-red-600 animate-pulse' : ''
              }`}
            >
              <span>🎙</span>
              <span>{recording ? 'Recording... (Click to stop)' : 'Record answer with Voice'}</span>
            </Button>

            <Button
              type="button"
              loading={submitting}
              onClick={handleSubmit}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl"
            >
              Submit answer →
            </Button>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
