'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CandidateAppShell } from '@/components/CandidateAppShell';
import { Button } from '@/components/ui/Button';
import { INDIAN_CITIES } from '@careerbridge/shared';

const MOCK_JOBS = [
  {
    id: 'job-1',
    title: 'Customer service executive',
    company: 'ABC Services',
    city: 'Chennai',
    salary: '₹18K – ₹22K',
    match: 86,
    type: 'Full Time',
    posted: '2 days ago',
  },
  {
    id: 'job-2',
    title: 'Front office executive',
    company: 'Sunrise Hotel',
    city: 'Chennai',
    salary: '₹16K – ₹20K',
    match: 71,
    type: 'Full Time',
    posted: '3 days ago',
  },
  {
    id: 'job-3',
    title: 'Client Relations Associate',
    company: 'Nexus Infotech',
    city: 'Bangalore',
    salary: '₹22K – ₹28K',
    match: 82,
    type: 'Hybrid',
    posted: 'Just now',
  },
  {
    id: 'job-4',
    title: 'Technical Support Executive',
    company: 'Zenith Global',
    city: 'Hyderabad',
    salary: '₹20K – ₹25K',
    match: 78,
    type: 'Full Time',
    posted: '1 day ago',
  },
];

function JobsSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('Customer service');
  const [city, setCity] = useState('Chennai');
  const [jobs, setJobs] = useState(MOCK_JOBS);

  return (
    <CandidateAppShell activeTab="jobs" maxWidth="max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Find jobs
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
            Discover verified jobs matched directly with your Career Passport skills.
          </p>
        </div>

        {/* Search Inputs & Filters Bar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Role or Keywords</label>
              <input
                type="text"
                placeholder="Search role or skill (e.g. Customer Service)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Location</label>
              <div className="relative">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-[#0a2e2c] focus:ring-2 focus:ring-[#0a2e2c]/10"
                >
                  <option value="Chennai">Chennai</option>
                  <option value="Bangalore">Bangalore</option>
                  <option value="Mumbai">Mumbai</option>
                  <option value="Delhi NCR">Delhi NCR</option>
                  <option value="Hyderabad">Hyderabad</option>
                  {INDIAN_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Chips Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap gap-2">
              {['Salary ▼', 'Experience ▼', 'Job type ▼', 'Skills ▼'].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            <Button
              type="button"
              onClick={() => {}}
              className="w-full sm:w-auto px-6 py-2.5 text-xs sm:text-sm font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white shadow-xs rounded-xl"
            >
              Search jobs
            </Button>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs sm:text-sm font-semibold text-slate-500">
            Showing <strong className="text-slate-900">{jobs.length}</strong> matched jobs
          </p>
        </div>

        {/* Responsive Multi-column Job Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md hover:border-[#0a2e2c]/30 transition"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#ecfdf5] border border-[#a7f3d0] px-2.5 py-0.5 text-[11px] font-bold text-[#059669]">
                    Match {job.match}%
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">{job.posted}</span>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 line-clamp-1">{job.title}</h2>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    {job.company} · {job.city}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {job.salary}
                  </span>
                  <span className="text-[10px] text-slate-400">{job.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="px-3.5 py-1.5 text-xs font-bold border-slate-200 text-slate-800 hover:bg-slate-50 rounded-xl"
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    onClick={() => router.push(`/jobs/${job.id}`)}
                    className="px-4 py-1.5 text-xs font-bold bg-[#0a2e2c] hover:bg-[#072422] text-white rounded-xl shadow-xs"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CandidateAppShell>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading jobs...</div>}>
      <JobsSearch />
    </Suspense>
  );
}
