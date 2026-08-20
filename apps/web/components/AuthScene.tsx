type Scene = 'candidate' | 'employer' | 'verify';

export function AuthScene({ kind, compact = false }: { kind: Scene; compact?: boolean }) {
  return (
    <div className={`relative ${compact ? 'mx-auto mb-6 h-36 w-full max-w-xs' : 'h-[320px] w-full max-w-md'}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="cb-orbit-slow absolute -left-8 top-8 h-40 w-40 rounded-full border border-accent/25" />
        <span className="cb-glow absolute right-6 top-4 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
        <span className="absolute bottom-4 left-1/4 h-px w-40 bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      </div>
      <div className="cb-float relative z-10">
        {kind === 'employer' ? <EmployerBoard /> : kind === 'verify' ? <OtpBoard /> : <PassportBoard />}
      </div>
    </div>
  );
}

function PassportBoard() {
  return (
    <article className="rounded-lg bg-primary p-6 text-white shadow-[0_30px_80px_rgba(11,28,28,0.28)]">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Career Passport</p>
        <span className="rounded-pill bg-accent px-2.5 py-1 text-[10px] font-bold text-primary">FREE</span>
      </div>
      <h3 className="mt-4 text-2xl font-extrabold text-white">Your profile, ready</h3>
      <p className="mt-1 text-sm text-white/60">Skills · Education · Experience</p>
      <div className="mt-5 h-1.5 overflow-hidden rounded-pill bg-white/10">
        <div className="h-full w-2/3 rounded-pill bg-accent" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {['64 Ready', 'Resume 70', 'Interview 58'].map((item) => (
          <div key={item} className="rounded-md border border-white/10 bg-black/20 px-2 py-3 text-center">
            <p className="text-[11px] font-bold text-accent">{item}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function EmployerBoard() {
  return (
    <article className="rounded-lg bg-primary p-6 text-white shadow-[0_30px_80px_rgba(11,28,28,0.28)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Employer desk</p>
      <h3 className="mt-4 text-2xl font-extrabold text-white">Find the right hire</h3>
      <div className="mt-5 space-y-2">
        {[
          ['Customer Success Associate', 'Chennai · 12 matches'],
          ['Retail Team Lead', 'Bengaluru · 8 matches'],
        ].map(([title, meta]) => (
          <div key={title} className="rounded-md border border-white/10 bg-black/20 px-3 py-3">
            <p className="text-sm font-bold text-white">{title}</p>
            <p className="text-xs text-white/55">{meta}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function OtpBoard() {
  return (
    <article className="rounded-lg bg-primary p-6 text-white shadow-[0_30px_80px_rgba(11,28,28,0.28)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">Secure verification</p>
      <h3 className="mt-4 text-2xl font-extrabold text-white">Enter your code</h3>
      <div className="mt-6 flex justify-center gap-2">
        {['1', '2', '3', '4', '5', '6'].map((digit, index) => (
          <span
            key={digit}
            className="flex h-11 w-9 items-center justify-center rounded-md border border-accent/40 bg-black/30 text-lg font-extrabold text-accent"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            {digit}
          </span>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-white/50">6-digit OTP · expires in 5 minutes</p>
    </article>
  );
}
