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
    <div className="relative hidden w-[38%] min-w-[280px] max-w-[480px] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#f8fbfb] via-white to-[#f0fdf4] p-6 md:flex md:p-8 lg:p-10 text-[#0f172a] select-none border-r border-slate-100">
      <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-sky-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-emerald-100/40 blur-3xl" />

      <div className="absolute top-20 left-4 text-[#0d9488] animate-pulse sm:left-6" aria-hidden="true">
        <svg className="h-5 w-5 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
        </svg>
      </div>
      <div
        className="absolute top-16 right-4 text-[#ca8a04] animate-pulse sm:right-6"
        style={{ animationDelay: '1.2s' }}
        aria-hidden="true"
      >
        <svg className="h-5 w-5 sm:h-7 sm:w-7" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
        </svg>
      </div>

      <div className="relative z-10 text-center md:text-left">
        <span className="text-lg font-black tracking-tight text-[#0a2e2c]">
          Career<span className="text-[#0d9488]">Bridge</span>
        </span>

        <h2 className="mt-2 text-lg font-extrabold tracking-tight text-[#0a2e2c] leading-tight lg:text-2xl">
          {isEmployer ? 'Hire verified talent simply and quickly' : headline}
        </h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          {isEmployer
            ? 'Access skilled profiles, track verified skills, and collaborate with our hiring team.'
            : subhead}
        </p>
      </div>

      <div className="relative z-10 my-auto flex flex-1 items-center justify-center py-1 sm:py-4">
        <div className="relative flex h-36 w-36 items-center justify-center sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-72 lg:w-72">
          <div className="absolute -inset-1.5 rounded-full border-[4px] border-[#0d9488] shadow-[0_0_25px_rgba(13,148,136,0.25)] cb-animate-pulse-ring pointer-events-none sm:-inset-2 sm:border-[6px] md:-inset-3 md:border-[8px]" />

          <div className="relative h-36 w-36 overflow-hidden rounded-full border-4 border-white shadow-[0_16px_36px_rgba(10,46,44,0.25)] sm:h-52 sm:w-52 md:h-60 md:w-60 lg:h-72 lg:w-72">
            <Image
              src={isEmployer ? '/auth/employer.png' : '/auth/candidate.png'}
              alt="CareerBridge candidate"
              fill
              sizes="(max-width: 640px) 192px, (max-width: 1024px) 256px, 288px"
              className="object-cover object-[center_15%] scale-110"
              priority
            />
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_30px_rgba(10,46,44,0.35)]" />
          </div>

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
            <p className="text-[10px] font-extrabold text-[#0a2e2c] leading-tight sm:text-xs">{statsLabel}</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden text-center text-[11px] text-slate-400 font-medium md:block md:text-left">
        Empowering careers with AI verification & recruiter matching.
      </div>
    </div>
  );
}
