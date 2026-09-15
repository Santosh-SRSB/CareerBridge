type Cue = 'search' | 'jobs' | 'calendar' | 'chart';

/** Small brand-colored cartoon cues for empty states (no logic). */
export function EmployerEmptyCue({ cue = 'search' }: { cue?: Cue }) {
  if (cue === 'jobs') {
    return (
      <div className="ep-empty-cue" aria-hidden>
        <svg viewBox="0 0 140 110" className="ep-empty-cue__art">
          <ellipse cx="70" cy="98" rx="42" ry="6" fill="#eef1f4" />
          <rect x="36" y="42" width="68" height="48" rx="10" fill="#fff" stroke="#d5dbe3" strokeWidth="2.5" />
          <path d="M52 42v-7a10 10 0 0 1 10-10h16a10 10 0 0 1 10 10v7" stroke="#e8a63b" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <rect x="58" y="58" width="24" height="10" rx="3" fill="#f3f6f9" />
          <g className="ep-empty-cue__bob">
            <circle cx="108" cy="34" r="16" fill="#fff" stroke="#d5dbe3" strokeWidth="2" />
            <circle cx="102" cy="32" r="1.6" fill="#3d4f5f" />
            <circle cx="114" cy="32" r="1.6" fill="#3d4f5f" />
            <path d="M104 38c2.2 2.2 7.8 2.2 10 0" stroke="#e8a63b" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d="M118 22c4-6 10-4 10 1" stroke="#e8a63b" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        </svg>
      </div>
    );
  }
  if (cue === 'calendar') {
    return (
      <div className="ep-empty-cue" aria-hidden>
        <svg viewBox="0 0 140 110" className="ep-empty-cue__art">
          <ellipse cx="70" cy="98" rx="40" ry="6" fill="#eef1f4" />
          <rect x="34" y="30" width="72" height="56" rx="10" fill="#fff" stroke="#d5dbe3" strokeWidth="2.5" />
          <rect x="34" y="30" width="72" height="16" rx="10" fill="#f7f9fb" />
          <path d="M50 24v14M90 24v14" stroke="#e8a63b" strokeWidth="3.5" strokeLinecap="round" />
          <circle className="ep-empty-cue__bob" cx="70" cy="68" r="12" fill="#fff8eb" stroke="#e8a63b" strokeWidth="2" />
          <path d="M65 68h10M70 63v10" stroke="#e8a63b" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  if (cue === 'chart') {
    return (
      <div className="ep-empty-cue ep-empty-cue--lg" aria-hidden>
        <svg viewBox="0 0 180 130" className="ep-empty-cue__art">
          <ellipse cx="90" cy="118" rx="54" ry="7" fill="#eef1f4" />
          {/* chart board */}
          <rect x="28" y="28" width="100" height="78" rx="12" fill="#fff" stroke="#d5dbe3" strokeWidth="2.5" />
          <path d="M42 92h72" stroke="#e8edf2" strokeWidth="2.5" strokeLinecap="round" />
          <rect className="ep-empty-cue__rise" x="48" y="62" width="14" height="30" rx="4" fill="#ffd89a" />
          <rect className="ep-empty-cue__rise ep-empty-cue__rise--2" x="70" y="48" width="14" height="44" rx="4" fill="#e8a63b" />
          <rect className="ep-empty-cue__rise ep-empty-cue__rise--3" x="92" y="38" width="14" height="54" rx="4" fill="#f0c56a" />
          {/* character */}
          <g className="ep-empty-cue__bob">
            <circle cx="148" cy="48" r="20" fill="#fff" stroke="#d5dbe3" strokeWidth="2.2" />
            <circle cx="141" cy="45" r="2" fill="#3d4f5f" />
            <circle cx="155" cy="45" r="2" fill="#3d4f5f" />
            <path d="M143 54c3 3.5 10 3.5 13 0" stroke="#e8a63b" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M158 30c5-8 12-5 12 2" stroke="#e8a63b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M132 70c6 14 26 14 32 0" stroke="#d5dbe3" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
          {/* floating dots */}
          <circle className="ep-empty-cue__float" cx="40" cy="22" r="3" fill="#e8a63b" opacity="0.7" />
          <circle className="ep-empty-cue__float ep-empty-cue__float--2" cx="118" cy="18" r="2.5" fill="#f0c56a" opacity="0.8" />
        </svg>
      </div>
    );
  }
  return (
    <div className="ep-empty-cue" aria-hidden>
      <svg viewBox="0 0 140 110" className="ep-empty-cue__art">
        <ellipse cx="70" cy="98" rx="40" ry="6" fill="#eef1f4" />
        <circle cx="58" cy="50" r="24" fill="#fff" stroke="#d5dbe3" strokeWidth="2.5" />
        <path d="M76 68 96 90" stroke="#e8a63b" strokeWidth="6" strokeLinecap="round" />
        <g className="ep-empty-cue__bob">
          <circle cx="102" cy="28" r="14" fill="#fff" stroke="#d5dbe3" strokeWidth="2" />
          <circle cx="97" cy="26" r="1.5" fill="#3d4f5f" />
          <circle cx="107" cy="26" r="1.5" fill="#3d4f5f" />
          <path d="M98 32c2 1.8 6 1.8 8 0" stroke="#e8a63b" strokeWidth="1.4" strokeLinecap="round" fill="none" />
        </g>
      </svg>
    </div>
  );
}
