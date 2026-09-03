'use client';

import { CandidateAppShell } from '@/components/CandidateAppShell';

export default function ApplicationsPage() {
  const applications = [
    {
      id: 'app-1',
      title: 'Customer service executive',
      company: 'ABC Services',
      date: 'Applied 10 Sep',
      step: 2, // Shortlisted
      status: 'active',
      salary: '₹18K – ₹22K',
      city: 'Chennai',
    },
    {
      id: 'app-2',
      title: 'Front office executive',
      company: 'Sunrise Hotel',
      date: 'Applied 8 Sep',
      step: 2,
      status: 'rejected',
      salary: '₹16K – ₹20K',
      city: 'Chennai',
    },
  ];

  return (
    <CandidateAppShell activeTab="applications" showBack title="My applications" maxWidth="max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            My applications
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Track real-time progress and interview invitations across all your submitted applications.
          </p>
        </div>

        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{app.title}</h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {app.company} · {app.city} · {app.date}
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
                  {app.salary}
                </span>
              </div>

              {/* Stepper Progress */}
              {app.status === 'rejected' ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-[#ef4444]" />
                    <div className="z-10 h-3 w-3 rounded-full bg-[#10b981]" />
                    <div className="z-10 h-3 w-3 rounded-full bg-[#ef4444]" />
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Applied</span>
                    <span className="text-[#ef4444]">Not selected</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200" />
                    <div className="absolute left-2 w-1/2 top-1/2 -translate-y-1/2 h-0.5 bg-[#10b981]" />
                    <div className="z-10 h-3 w-3 rounded-full bg-[#10b981]" />
                    <div className="z-10 h-3 w-3 rounded-full bg-[#10b981]" />
                    <div className="z-10 h-3 w-3 rounded-full bg-slate-200" />
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-slate-600">Applied</span>
                    <span className="text-[#0a2e2c]">Shortlisted</span>
                    <span className="text-slate-400">Interview</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </CandidateAppShell>
  );
}
