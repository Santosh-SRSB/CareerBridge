function Ring({ value }: { value: number }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="relative h-[104px] w-[104px]">
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#f15a24"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold leading-none text-accent">{value}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Ready</span>
      </div>
    </div>
  );
}

export function PassportPreview({
  name = 'Priya Sharma',
  location = 'Bengaluru',
  role = 'Data Analyst',
  ready = 64,
  skills = ['SQL', 'Excel'],
  resumeScore = 70,
  interviewScore = 58,
}: {
  name?: string;
  location?: string;
  role?: string;
  ready?: number;
  skills?: string[];
  resumeScore?: number | null;
  interviewScore?: number | null;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <article className="relative overflow-hidden rounded-lg bg-primary p-5 text-white shadow-[0_30px_80px_rgba(12,51,64,0.32)]">
      <div className="absolute right-4 top-0 h-5 w-8 rounded-b-md bg-white/15" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-12 items-center justify-center rounded-sm border border-white/20 bg-[#163433] text-sm font-bold text-accent shadow-inner">
            {initials || 'CB'}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-accent">Career Passport</p>
            <h3 className="text-lg font-extrabold leading-tight">{name}</h3>
            <p className="text-xs text-white/65">
              {location}
              {role ? ` · ${role}` : ''}
            </p>
          </div>
        </div>
        <span className="rounded-pill bg-accent px-3 py-1 text-xs font-bold text-white">FREE</span>
      </div>

      <div className="relative mt-5 flex items-center justify-between gap-4">
        <Ring value={ready} />
        <div className="flex flex-wrap justify-end gap-2">
          {skills.slice(0, 4).map((skill) => (
            <span key={skill} className="rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              {skill}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-white/55">Resume</p>
          <p className="mt-1 text-2xl font-extrabold text-accent">{resumeScore ?? '—'}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-white/55">Interview</p>
          <p className="mt-1 text-2xl font-extrabold text-accent">{interviewScore ?? '—'}</p>
        </div>
      </div>
      <p className="relative mt-4 text-[10px] font-semibold tracking-[0.14em] text-white/40">ID CB-2048 · Issued 2026</p>
    </article>
  );
}
