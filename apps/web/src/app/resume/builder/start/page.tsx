'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';

export default function ResumeBuilderStartPage() {
  const router = useRouter();
  const [name, setName] = useState('Rahul Kumar');
  const [summary, setSummary] = useState(
    'Customer-focused professional with strong communication skills and a passion for helping people.',
  );
  const [skills, setSkills] = useState(['English', 'Communication', 'Customer handling']);

  const steps = [
    { label: 'Personal', active: true, done: true },
    { label: 'Education', active: true, done: false },
    { label: 'Experience', active: false, done: false },
    { label: 'Skills', active: false, done: false },
    { label: 'Review', active: false, done: false },
  ];

  function handleSaveAndContinue() {
    router.push('/resume/preview');
  }

  return (
    <CandidateAppShell activeTab="profile" showBack title="Build your resume" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Build your resume
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Fill in your details once and generate an ATS-ready professional resume.
          </p>
        </div>

        {/* Horizontal Stepper */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between relative px-2 max-w-2xl mx-auto">
            <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-slate-200 z-0" />
            <div className="absolute top-1/2 left-4 w-1/4 -translate-y-1/2 h-0.5 bg-[#0a2e2c] z-0" />
            {steps.map((step, idx) => (
              <div key={step.label} className="flex flex-col items-center gap-1.5 z-10">
                <div
                  className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    idx === 0
                      ? 'border-[#0a2e2c] bg-[#0a2e2c] text-white text-[9px] font-bold'
                      : idx === 1
                        ? 'border-[#0a2e2c] bg-white'
                        : 'border-slate-300 bg-white'
                  }`}
                >
                  {idx === 0 ? '✓' : ''}
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    idx <= 1 ? 'text-[#0a2e2c]' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form Fields Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <div className="grid grid-cols-1 gap-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
              />
            </div>

            {/* Professional Summary */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Professional summary
              </label>
              <textarea
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
              />
            </div>

            {/* Experience */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Work Experience
              </label>
              <button
                type="button"
                className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-4 text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition"
              >
                + Add work experience or internship
              </button>
            </div>

            {/* Education */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Education
              </label>
              <button
                type="button"
                className="w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-4 text-xs font-bold text-slate-700 hover:bg-slate-100/70 transition"
              >
                + Add degree, diploma or high school
              </button>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Skills
              </label>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-slate-100 border border-slate-200 px-3.5 py-1.5 text-xs font-bold text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              onClick={handleSaveAndContinue}
              className="w-full sm:w-auto px-8 py-3.5 text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-md hover:shadow-lg transition rounded-xl"
            >
              Save and continue →
            </Button>
          </div>
        </div>
      </div>
    </CandidateAppShell>
  );
}
