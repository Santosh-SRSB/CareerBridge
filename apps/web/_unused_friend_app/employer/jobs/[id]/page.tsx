'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { EmployerApplication } from '@careerbridge/shared';
import { changeApplicationStatus, listEmployerApplications } from '@/lib/api';
import { EmployerHeader, EmployerNav } from '@/components/EmployerNav';
import { StatusBadge } from '@/components/AppNav';

const ACTIONS = [
  { value: 'REVIEW', label: 'Review' },
  { value: 'SHORTLIST', label: 'Shortlist' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'SELECT', label: 'Select' },
  { value: 'REJECT', label: 'Not selected' },
];

export default function EmployerJobApplicationsPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<EmployerApplication[]>([]);

  async function load() {
    setItems(await listEmployerApplications(params.id));
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <EmployerHeader />
      <h1 className="mt-4 text-2xl font-bold text-primary">Applications</h1>
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <section key={item.id} className="rounded-md bg-surface p-5 shadow-sm">
            <p className="font-semibold text-primary">{[item.candidate.firstName, item.candidate.lastName].filter(Boolean).join(' ') || 'Candidate'}</p>
            <p className="text-sm text-muted">{item.candidate.city} · {item.candidate.skills.join(', ')}</p>
            {item.match ? <p className="mt-2 text-sm text-accent">Match {item.match.score}%</p> : null}
            <div className="mt-2"><StatusBadge status={item.status} /></div>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  className="rounded-sm border border-primary/20 px-3 py-2 text-sm font-semibold text-primary"
                  onClick={async () => {
                    await changeApplicationStatus(item.id, action.value);
                    await load();
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <EmployerNav />
    </main>
  );
}
