import Link from 'next/link';
import type { PassportSection } from '@careerbridge/shared';

function prettyText(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function PassportCrest({ light = false }: { light?: boolean }) {
  const mark = light ? '#0a2e2c' : '#fff';
  return (
    <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden>
      <circle cx="20" cy="20" r="18" fill="none" stroke="#eab308" strokeWidth="1.4" />
      <circle cx="20" cy="20" r="14" fill="none" stroke="#14b8a6" strokeWidth="1" />
      <path d="M10 22c4-8 16-8 20 0" fill="none" stroke="#eab308" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 18h16M20 12v14" fill="none" stroke={mark} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export { PassportCrest };

function PassportSeal({ value }: { value: number }) {
  const safe = Math.min(100, Math.max(0, value));
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="cb-passport-ready relative h-[84px] w-[84px] shrink-0">
      <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90">
        <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="7" />
        <circle
          cx="42"
          cy="42"
          r={radius}
          fill="none"
          stroke="#14b8a6"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-extrabold leading-none tracking-tight text-white">{safe}</span>
        <span className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/70">Ready</span>
      </div>
    </div>
  );
}

export function CareerPassportCard({
  name,
  location,
  percentage,
  doneCount,
  totalCount,
  skills = [],
  photoUrl,
  passportId,
  sections = [],
  showSections = true,
}: {
  name: string;
  location: string;
  percentage: number;
  doneCount: number;
  totalCount: number;
  skills?: string[];
  photoUrl?: string | null;
  passportId?: string;
  sections?: PassportSection[];
  showAction?: boolean;
  showSections?: boolean;
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
  const visibleSections = showSections ? sections : [];

  return (
    <article className="cb-passport-light w-full max-w-[360px]">
      <div className="cb-passport-inner relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-white">Career Passport</p>
            <p className="text-[10px] font-semibold text-white/55">
              {doneCount} of {totalCount} complete
            </p>
          </div>
          <span className="rounded-pill bg-[#14b8a6] px-2.5 py-1 text-[10px] font-bold text-[#0a2e2c]">FREE</span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="cb-passport-photo relative shrink-0 overflow-hidden">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-extrabold text-white">{initials || 'CB'}</span>
            )}
            <span className="cb-id-chip" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-extrabold leading-tight text-white">{displayName}</h3>
            <p className="truncate text-[11px] text-white/70">{displayPlace}</p>
            <p className="mt-1 text-[11px] font-semibold text-white">
              You&apos;re <span className="text-teal">{percentage}%</span> ready
            </p>
          </div>
          <PassportSeal value={percentage} />
        </div>

        {visibleSections.length ? (
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {visibleSections.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className={`cb-visa-stamp ${item.done ? 'is-done' : ''}`}>
                  <span className="truncate">{item.label.replace(' Information', '').replace('Career ', '')}</span>
                  <span className="tabular-nums">{item.weight > 0 ? `${item.weight}%` : item.done ? '✓' : '+'}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}

        {skills.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {skills.slice(0, 4).map((skill) => (
              <span key={skill} className="rounded-pill bg-[#14b8a6] px-2 py-0.5 text-[9px] font-semibold text-[#0a2e2c]">
                {prettyText(skill)}
              </span>
            ))}
          </div>
        ) : null}

        <p className="cb-passport-mrz">
          {passportId || 'CB-0000'} · {year}
        </p>
      </div>
    </article>
  );
}
