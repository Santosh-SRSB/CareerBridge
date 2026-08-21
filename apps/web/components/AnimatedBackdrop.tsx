export function AnimatedBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="cb-animated-grid absolute inset-0 opacity-70" />
      <div className="cb-glow absolute -left-16 -top-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div className="cb-orbit-slow absolute -right-10 top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
      <div className="cb-float absolute bottom-10 left-1/3 h-40 w-40 rounded-full bg-orange/10 blur-3xl" />
    </div>
  );
}
