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
  subhead = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et.',
  statsLabel = '100k + Jobholder Get Job',
  badgeText = 'A Better Path to more opportunity',
  scene = 'candidate',
}: Props) {
  const isEmployer = scene === 'employer';
  const cutoutSrc = isEmployer ? '/auth/employer-cutout.png' : '/auth/candidate-cutout.png';

  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#f8fbfb] via-white to-[#f0fdf4] p-6 sm:p-8 lg:p-10 xl:p-12 text-[#0f172a] select-none border-b lg:border-b-0 lg:border-r border-slate-100">
      {/* Background Soft Organic Waves */}
      <div className="pointer-events-none absolute -left-20 top-0 h-96 w-96 rounded-full bg-sky-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-emerald-100/40 blur-3xl" />

      {/* Sparkle 1: Teal 4-point star (Left) */}
      <div className="absolute top-28 left-6 sm:left-10 text-[#0d9488] animate-pulse" aria-hidden="true">
        <svg className="h-6 w-6 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
        </svg>
      </div>

      {/* Sparkle 2: Amber/Gold 4-point star (Right) */}
      <div className="absolute top-24 right-8 sm:right-12 text-[#ca8a04] animate-pulse" style={{ animationDelay: '1.2s' }} aria-hidden="true">
        <svg className="h-6 w-6 sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0L14.6 9.4L24 12L14.6 14.6L12 24L9.4 14.6L0 12L9.4 9.4L12 0Z" />
        </svg>
      </div>

      {/* Top Brand Header */}
      <div className="relative z-10 max-w-md mx-auto text-center">
        {/* Logo / Badge */}
        <div className="inline-flex items-center justify-center gap-2 mb-2 sm:mb-3">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-tr from-[#0a2e2c] via-[#0d9488] to-[#ca8a04] p-0.5 shadow-sm">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-white text-[11px] sm:text-xs font-black text-[#0a2e2c]">
              CB
            </div>
          </div>
          <span className="text-lg sm:text-xl font-black tracking-tight text-[#0a2e2c]">
            Career<span className="text-[#0d9488]">Bridge</span>
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight text-[#0a2e2c] leading-tight">
          {isEmployer ? 'Hire verified talent simply and quickly' : headline}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
          {isEmployer
            ? 'Access skilled profiles, track verified skills, and collaborate with our hiring team.'
            : subhead}
        </p>
      </div>

      {/* Center Illustration with Elegant Emerald Circle, Teal Accent Ring, Floating Cards and Cutout Person */}
      <div className="relative z-10 my-auto py-4 sm:py-6 flex items-center justify-center">
        <div className="relative flex h-64 w-64 sm:h-76 sm:w-76 xl:h-96 xl:w-96 items-center justify-center">

          {/* Outer Accent Ring */}
          <div className="absolute -inset-2 sm:-inset-3 rounded-full border-[6px] sm:border-[8px] xl:border-[10px] border-[#0d9488] shadow-[0_0_25px_rgba(13,148,136,0.25)] cb-animate-pulse-ring pointer-events-none" />

          {/* Inner Premium Emerald-Teal Circle Framing the Realistic Professional Portrait */}
          <div className="relative inset-0 h-64 w-64 sm:h-76 sm:w-76 xl:h-96 xl:w-96 rounded-full overflow-hidden shadow-[0_16px_36px_rgba(10,46,44,0.25)] border-4 border-white">
            <Image
              src={isEmployer ? '/auth/employer.png' : '/auth/candidate.png'}
              alt="CareerBridge Candidate"
              fill
              sizes="(max-width: 640px) 256px, (max-width: 1280px) 304px, 384px"
              className="object-cover object-[center_15%] scale-110 transition-transform duration-700 hover:scale-115"
              priority
            />
            {/* Subtle soft vignette lighting for natural blending */}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_30px_rgba(10,46,44,0.35)]" />
          </div>

          {/* Left Floating Card: "100k + Jobholder Get Job" with Avatars */}
          <div className="absolute -left-3 sm:-left-8 bottom-3 sm:bottom-6 z-30 flex items-center gap-2 sm:gap-3 rounded-2xl bg-white/95 px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_16px_36px_rgba(10,46,44,0.14)] border border-white/80 backdrop-blur-md cb-animate-float-delayed hover:scale-105 transition-transform">
            <div className="flex -space-x-2 sm:-space-x-2.5 overflow-hidden">
              <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#0a2e2c] text-[9px] sm:text-[10px] font-extrabold text-white ring-2 ring-white shadow-sm">
                RK
              </span>
              <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#0d9488] text-[9px] sm:text-[10px] font-extrabold text-white ring-2 ring-white shadow-sm">
                PS
              </span>
              <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#ca8a04] text-[9px] sm:text-[10px] font-extrabold text-white ring-2 ring-white shadow-sm">
                AK
              </span>
              <span className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[#14b8a6] text-[9px] sm:text-[10px] font-black text-white ring-2 ring-white shadow-sm">
                +
              </span>
            </div>
            <div className="text-left">
              <p className="text-[11px] sm:text-xs font-extrabold text-[#0a2e2c] leading-tight">{statsLabel}</p>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Footer Credits */}
      <div className="relative z-10 text-center text-[10.5px] sm:text-[11px] text-slate-400 font-medium">
        <span>Empowering careers with AI verification & recruiter matching.</span>
      </div>
    </div>
  );
}
