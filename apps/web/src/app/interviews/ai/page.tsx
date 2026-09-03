'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function AIMockInterviewSetupPage() {
  const router = useRouter();
  const [role, setRole] = useState('Customer service executive');
  const [interviewType, setInterviewType] = useState<'General' | 'Role specific'>('General');
  const [questionsCount, setQuestionsCount] = useState('5');
  const [loading, setLoading] = useState(false);

  function handleStart() {
    setLoading(true);
    setTimeout(() => {
      router.push('/interviews/mock/question');
    }, 300);
  }

  return (
    <CandidateAppShell activeTab="interviews" showBack title="AI mock interview" maxWidth="max-w-3xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            AI Mock Interview Setup
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Simulate real interview questions, practice speech answers, and receive detailed AI evaluation.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="space-y-5">
            {/* Job Role */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Target Job Role</label>
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
                >
                  <option value="Customer service executive">Customer service executive</option>
                  <option value="Front office executive">Front office executive</option>
                  <option value="Sales executive">Sales executive</option>
                  <option value="Retail associate">Retail associate</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Interview Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Interview Format</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setInterviewType('General')}
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition ${
                    interviewType === 'General'
                      ? 'border-[#0a2e2c] bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    checked={interviewType === 'General'}
                    onChange={() => setInterviewType('General')}
                    className="h-4 w-4 text-[#0a2e2c] focus:ring-[#0a2e2c]"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">General HR Screening</span>
                    <span className="text-xs text-slate-500">Core strengths, behavior, communication</span>
                  </div>
                </label>

                <label
                  onClick={() => setInterviewType('Role specific')}
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer transition ${
                    interviewType === 'Role specific'
                      ? 'border-[#0a2e2c] bg-emerald-50/50 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    checked={interviewType === 'Role specific'}
                    onChange={() => setInterviewType('Role specific')}
                    className="h-4 w-4 text-[#0a2e2c] focus:ring-[#0a2e2c]"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900 block">Role Specific Scenarios</span>
                    <span className="text-xs text-slate-500">Customer complaints, processes, tools</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Number of questions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Number of Questions
              </label>
              <div className="relative">
                <select
                  value={questionsCount}
                  onChange={(e) => setQuestionsCount(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
                >
                  <option value="3">3 Questions (Quick ~5 mins)</option>
                  <option value="5">5 Questions (Standard ~10 mins)</option>
                  <option value="10">10 Questions (Comprehensive ~20 mins)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              loading={loading}
              onClick={handleStart}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl"
            >
              Start mock interview →
            </Button>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
