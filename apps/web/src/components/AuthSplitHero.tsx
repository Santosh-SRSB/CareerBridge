import Image from 'next/image';

type Props = {
  headline?: string;
  subhead?: string;
  statsLabel?: string;
  badgeText?: string;
  scene?: 'candidate' | 'employer' | 'verify';
};

export function AuthSplitHero({
  headline = 'Find your dream job simply and quickly',
  subhead = 'Build your verified Career Passport and get discovered by top companies.',
  statsLabel = '100k + Jobholder Get Job',
  scene = 'candidate',
}: Props) {
  const isEmployer = scene === 'employer';

  return (
    <div
      className={`relative hidden w-[38%] min-w-[280px] max-w-[480px] shrink-0 flex-col justify-between overflow-hidden p-6 md:flex md:p-8 lg:p-10 select-none border-r ${
        isEmployer
          ? 'bg-[#0d2826] text-[#f7faf9] border-[#0d2826]'
          : 'bg-gradient-to-br from-[#f8fbfb] via-white to-[#f0fdf4] text-[#0f172a] border-slate-100'
      }`}
    >
      {!isEmployer ? (
        <>
          <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-sky-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-emerald-100/40 blur-3xl" />
        </>
      ) : (
        <>
          <div className="pointer-events-none absolute -left-16 top-10 h-64 w-64 rounded-full bg-[#1f6f66]/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#c4b896]/15 blur-3xl" />
        </>
      )}

      <div className="relative z-10 text-center md:text-left">
        <span
          className={`text-lg font-black tracking-tight ${
            isEmployer ? 'text-[#f7faf9]' : 'text-[#0a2e2c]'
          }`}
        >
          Career
          <span className={isEmployer ? 'text-[#c4b896]' : 'text-[#0d9488]'}>Bridge</span>
        </span>

        <h2
          className={`mt-2 text-lg font-extrabold tracking-tight leading-tight lg:text-2xl ${
            isEmployer ? 'text-[#f7faf9]' : 'text-[#0a2e2c]'
          }`}
        >
          {isEmployer ? 'Hire verified talent with clarity' : headline}
        </h2>
        <p
          className={`mt-2 text-sm leading-relaxed ${
            isEmployer ? 'text-[#a8bbb7]' : 'text-slate-500'
          }`}
        >
          {isEmployer
            ? 'Post roles, review matched profiles, and move hiring forward from one professional workspace.'
            : subhead}
        </p>
      </div>

      <div className="relative z-10 my-auto flex flex-1 items-center justify-center py-1 sm:py-4">
        <div className="relative flex h-36 w-36 items-center justify-center sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-72 lg:w-72">
          <div
            className={`absolute -inset-1.5 rounded-full border-[4px] pointer-events-none sm:-inset-2 sm:border-[6px] md:-inset-3 md:border-[8px] ${
              isEmployer
                ? 'border-[#c4b896]/70 shadow-[0_0_28px_rgba(196,184,150,0.18)] ep-auth-employer-glow'
                : 'border-[#0d9488] shadow-[0_0_25px_rgba(13,148,136,0.25)] cb-animate-pulse-ring'
            }`}
          />

          <div
            className={`relative h-36 w-36 overflow-hidden rounded-full border-4 border-white shadow-[0_16px_36px_rgba(10,46,44,0.25)] sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-72 lg:w-72 ${
              isEmployer ? 'ep-auth-employer-float' : ''
            }`}
          >
            <Image
              src={isEmployer ? '/auth/employer.png' : '/auth/candidate.png'}
              alt={isEmployer ? 'CareerBridge employer' : 'CareerBridge candidate'}
              fill
              sizes="(max-width: 640px) 192px, (max-width: 1024px) 256px, 288px"
              className="object-cover object-[center_15%] scale-110"
              priority
            />
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_30px_rgba(10,46,44,0.35)]" />
          </div>

          {!isEmployer ? (
            <div className="absolute -bottom-1 left-1/2 z-30 hidden w-max max-w-[140px] -translate-x-1/2 items-center gap-1.5 rounded-xl border border-white/80 bg-white/95 px-2 py-1.5 shadow-[0_12px_28px_rgba(10,46,44,0.14)] backdrop-blur-md sm:flex sm:-left-4 sm:bottom-3 sm:max-w-none sm:translate-x-0 sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-2 md:-left-6 md:bottom-4 md:px-4 md:py-2.5">
              <div className="flex -space-x-2 overflow-hidden">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0a2e2c] text-[9px] font-extrabold text-white ring-2 ring-white">
                  RK
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0d9488] text-[9px] font-extrabold text-white ring-2 ring-white">
                  PS
                </span>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ca8a04] text-[9px] font-extrabold text-white ring-2 ring-white">
                  AK
                </span>
              </div>
              <p className="text-[10px] font-extrabold text-[#0a2e2c] leading-tight sm:text-xs">
                {statsLabel}
              </p>
            </div>
          ) : (
            <div className="absolute -bottom-1 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-2 rounded-xl border border-white/15 bg-[#0d2826]/90 px-3 py-2 backdrop-blur-md sm:flex sm:bottom-3 md:bottom-4">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#c4b896]" />
              <p className="text-[11px] font-semibold tracking-wide text-[#f7faf9]">
                Verified hiring workspace
              </p>
            </div>
          )}
        </div>
      </div>

      <div
        className={`relative z-10 hidden text-[11px] font-medium md:block md:text-left ${
          isEmployer ? 'text-[#7a908c]' : 'text-center text-slate-400'
        }`}
      >
        {isEmployer
          ? 'Built for recruiters who need speed, trust, and a clear pipeline.'
          : 'Empowering careers with AI verification & recruiter matching.'}
      </div>
    </div>
  );
}
