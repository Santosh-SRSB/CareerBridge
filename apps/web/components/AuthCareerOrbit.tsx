import { PassportPreview } from '@/components/PassportPreview';

const JOBS = [
  { role: 'Data Analyst', meta: 'Bengaluru · Full-time', tag: 'New' },
  { role: 'UX Designer', meta: 'Pune · Hybrid', tag: 'Match 86%' },
  { role: 'Java Developer', meta: 'Hyderabad · On-site', tag: 'Hiring' },
];

export function AuthCareerOrbit({ scene = 'candidate' }: { scene?: 'candidate' | 'employer' | 'verify' }) {
  const isEmployer = scene === 'employer';
  const path = isEmployer
    ? [
        ['01', 'Post a job'],
        ['02', 'Review passports'],
        ['03', 'Shortlist'],
        ['04', 'Hire'],
      ]
    : [
        ['01', 'Build profile'],
        ['02', 'Improve scores'],
        ['03', 'Career Passport'],
        ['04', 'Get hired'],
      ];

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] hidden lg:block">
      <div className="cb-notice absolute left-8 top-8 max-w-xs rounded-md bg-white/95 px-4 py-3 shadow-[0_16px_40px_rgba(12,51,64,0.2)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal">Live</p>
        <p className="mt-1 text-sm font-bold text-primary">
          {isEmployer ? '14 passports match your new role' : '3 jobs match your Career Passport'}
        </p>
        <p className="mt-0.5 text-xs text-muted">{isEmployer ? 'Posted 2 hours ago · Bengaluru' : 'Updated just now · Resume 70'}</p>
      </div>

      <aside className="absolute left-8 top-[42%] w-52 -translate-y-1/2 rounded-lg bg-white p-4 shadow-[0_20px_50px_rgba(12,51,64,0.22)]">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Career path</p>
        <ol className="space-y-3">
          {path.map(([n, label]) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-extrabold text-white">
                {n}
              </span>
              <span className="text-sm font-bold text-primary">{label}</span>
            </li>
          ))}
        </ol>
      </aside>

      <div className="cb-job-stack absolute bottom-10 left-8 w-64">
        {JOBS.map((job, index) => (
          <article
            key={job.role}
            className="cb-job-card absolute left-0 w-full rounded-md bg-white p-4 shadow-[0_18px_40px_rgba(12,51,64,0.18)]"
            style={{
              bottom: index * 18,
              transform: `rotate(${index === 0 ? -6 : index === 1 ? -1.5 : 4}deg)`,
              zIndex: JOBS.length - index,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-extrabold text-primary">{job.role}</h3>
                <p className="mt-0.5 text-xs text-muted">{job.meta}</p>
              </div>
              <span className="rounded-pill bg-orange/10 px-2 py-0.5 text-[10px] font-bold text-orange">{job.tag}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="absolute right-8 top-1/2 w-[300px] -translate-y-1/2">
        {isEmployer ? (
          <div className="rounded-lg bg-white p-5 shadow-[0_28px_60px_rgba(12,51,64,0.28)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Hiring desk</p>
            <h3 className="mt-2 text-lg font-extrabold text-primary">Review real passports</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Scores, skills, and readiness — before you call for an interview.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-primary/5 py-2">
                <p className="text-lg font-extrabold text-orange">64</p>
                <p className="text-[10px] font-bold text-muted">Ready</p>
              </div>
              <div className="rounded-md bg-primary/5 py-2">
                <p className="text-lg font-extrabold text-orange">70</p>
                <p className="text-[10px] font-bold text-muted">Resume</p>
              </div>
              <div className="rounded-md bg-primary/5 py-2">
                <p className="text-lg font-extrabold text-orange">58</p>
                <p className="text-[10px] font-bold text-muted">Interview</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="cb-passport-desk">
            <PassportPreview />
          </div>
        )}
        <p className="mt-3 text-center text-xs font-semibold text-white/85 drop-shadow">
          {isEmployer ? 'Trusted by hiring teams' : 'Free Career Passport · Always yours'}
        </p>
      </div>
    </div>
  );
}
