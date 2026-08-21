import Link from 'next/link';

function prettyText(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function PassportSeal({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="cb-passport-ready relative h-[72px] w-[72px] shrink-0">
      <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
        <circle cx="36" cy="36" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="#14b8a6"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-extrabold leading-none tracking-tight text-white">{safe}</span>
        <span className="text-[7px] font-bold uppercase tracking-[0.16em] text-white/70">Ready</span>
      </div>
    </div>
  );
}

export function PassportPreview({
  name = 'Priya Sharma',
  location = 'Bengaluru',
  role,
  ready = 64,
  skills = ['SQL', 'Excel'],
  photoUrl,
  resumeScore = 70,
  interviewScore = 58,
  passportId,
}: {
  name?: string;
  location?: string;
  role?: string;
  ready?: number;
  skills?: string[];
  photoUrl?: string | null;
  resumeScore?: number | null;
  interviewScore?: number | null;
  passportId?: string;
}) {
  const displayName = prettyText(name);
  const displayPlace = prettyText(location);
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  const year = new Date().getFullYear();
  const id = passportId || 'CB-2048';

  return (
    <article className="cb-passport-light">
      <span className="cb-passport-spine" aria-hidden />
      <span className="cb-passport-grain" aria-hidden />
      <span className="cb-passport-guilloche" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.22em] text-white">Career Passport</p>
          <span className="shrink-0 rounded-pill bg-gradient-to-r from-[#ca8a04] to-[#eab308] px-2 py-0.5 text-[9px] font-extrabold text-navy">FREE</span>
        </div>

        <div className="mt-3 flex items-center gap-2.5">
          <div className="cb-passport-photo relative shrink-0 overflow-hidden">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-extrabold tracking-tight text-white">{initials || 'CB'}</span>
            )}
            <span className="cb-id-chip" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-extrabold leading-tight text-white">{displayName}</h3>
            <p className="truncate text-[11px] text-white/70">
              {displayPlace}
              {role ? ` · ${role}` : ''}
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-4 text-white/90">
              You&apos;re <span className="text-[#eab308]">{ready}%</span> ready
            </p>
          </div>
          <PassportSeal value={ready} />
        </div>

        {skills.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="rounded-pill bg-[#14b8a6] px-2 py-0.5 text-[9px] font-semibold text-[#0a2e2c]"
              >
                {prettyText(skill)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="relative mt-2.5 grid grid-cols-2 gap-2">
          <div className="cb-passport-stat">
            <p>Resume</p>
            <strong>{resumeScore ?? '—'}</strong>
          </div>
          <div className="cb-passport-stat">
            <p>Interview</p>
            <strong>{interviewScore ?? '—'}</strong>
          </div>
        </div>

        <div className="relative mt-3 flex flex-col items-center">
          <Link
            href={ready < 100 ? '/passport/personal?flow=1' : '/passport?overview=1'}
            className="inline-flex h-8 items-center rounded-full bg-gradient-to-r from-[#ca8a04] to-[#eab308] px-3.5 text-xs font-extrabold text-navy shadow-[0_8px_18px_rgba(10,46,44,0.22)] transition hover:brightness-110"
          >
            {ready < 100 ? 'Complete Passport' : 'View Passport'}
          </Link>
          <p className="cb-passport-mrz">
            {id} • {year}
          </p>
        </div>
      </div>
    </article>
  );
}
