'use client';

/** Golden / yellow-amber star rating control. */
export function StarRating({
  value,
  onChange,
  size = 'md',
  label = 'Rating',
}: {
  value: number;
  onChange: (next: number) => void;
  size?: 'md' | 'lg';
  label?: string;
}) {
  const px = size === 'lg' ? 'h-10 w-10 sm:h-11 sm:w-11' : 'h-9 w-9';
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center justify-center gap-1.5 sm:gap-2">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            onClick={() => onChange(star)}
            className={`${px} inline-flex items-center justify-center rounded-full transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60`}
          >
            <svg viewBox="0 0 24 24" className="h-[85%] w-[85%]" aria-hidden>
              <defs>
                <linearGradient id={`cb-star-grad-${star}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="45%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <path
                d="M12 2.6l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 16.5 6.6 19.4l1-6.1L3.2 9l6.1-.9L12 2.6z"
                fill={active ? `url(#cb-star-grad-${star})` : 'none'}
                stroke={active ? '#f59e0b' : '#cbd5e1'}
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
