export function EagleMascot({
  pose = "stand",
}: {
  pose?: "fly" | "stand" | "arrow";
}) {
  return (
    <div className={`eagle eagle-${pose}`} aria-hidden="true">
      <svg viewBox="0 0 140 150" width="140" height="150">
        <ellipse cx="70" cy="142" rx="28" ry="6" fill="rgba(9,53,78,0.12)" />
        <path
          className="eagle-wing-l"
          d="M52 62 C18 48 8 28 22 18 C40 38 52 52 58 64"
          fill="#c4a574"
        />
        <path
          className="eagle-wing-r"
          d="M88 62 C122 48 132 28 118 18 C100 38 88 52 82 64"
          fill="#c4a574"
        />
        <circle cx="70" cy="36" r="16" fill="#d9b48a" />
        <path d="M54 32 C58 18 82 18 86 32 C76 24 64 24 54 32" fill="#3b2a1a" />
        <circle cx="64" cy="36" r="2.2" fill="#0b2433" />
        <circle cx="76" cy="36" r="2.2" fill="#0b2433" />
        <path d="M66 42 L70 48 L74 42" fill="#f25c22" />
        <rect x="52" y="62" width="36" height="34" rx="8" fill="#09354e" />
        <rect x="58" y="70" width="24" height="4" rx="2" fill="#3ecfdc" />
        <rect x="54" y="94" width="14" height="28" rx="5" fill="#f25c22" />
        <rect x="72" y="94" width="14" height="28" rx="5" fill="#f25c22" />
        <rect x="54" y="118" width="14" height="8" rx="3" fill="#062433" />
        <rect x="72" y="118" width="14" height="8" rx="3" fill="#062433" />
        <path d="M88 78 L108 86 L88 90 Z" fill="#d9b48a" />
      </svg>
    </div>
  );
}
