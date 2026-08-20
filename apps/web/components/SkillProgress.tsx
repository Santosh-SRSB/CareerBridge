'use client';

export function SkillProgress({
  total,
  current,
  justTicked = null,
  revealAll = false,
}: {
  total: number;
  current: number;
  justTicked?: number | null;
  revealAll?: boolean;
}) {
  const lastShown = revealAll ? total - 1 : Math.max(0, justTicked != null ? justTicked : current);
  const count = Math.min(total, lastShown + 1);

  return (
    <ol className="cb-ticks is-live" aria-label="Question progress">
      {Array.from({ length: count }, (_, index) => {
        const done = index < current || index === justTicked || (revealAll && index < total);
        const active = !revealAll && index === current && index !== justTicked;
        return (
          <li
            key={index}
            className={`cb-tick ${index >= 3 ? 'is-cam' : ''} ${done ? 'is-done' : ''} ${active ? 'is-now' : ''} ${
              justTicked === index ? 'is-pop' : ''
            } ${index === lastShown && !revealAll ? 'is-fresh' : ''}`}
          >
            <span className="cb-tick-orb">
              {done ? (
                <svg viewBox="0 0 24 24" className="cb-tick-mark" aria-hidden>
                  <path d="M5 13.2 9.4 17.5 19 7.5" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <em>{index < 3 ? 'MCQ' : 'Cam'}</em>
          </li>
        );
      })}
    </ol>
  );
}
