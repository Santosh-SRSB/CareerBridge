'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export function SkillAssessmentPopup({
  onClose,
}: {
  onClose: () => void;
}) {
  const router = useRouter();

  function go() {
    onClose();
    router.push('/assessments');
  }

  return (
    <div className="cb-skill-popup-scrim" role="dialog" aria-labelledby="cb-skill-popup-title">
      <div className="cb-skill-popup-card">
        <button type="button" className="cb-skill-popup-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <p className="cb-skill-popup-kicker">Next step</p>
        <h2 id="cb-skill-popup-title">Skills Assessment</h2>
        <div className="cb-skill-popup-photo">
          <Image src="/brand/mascot-coach.png" alt="" width={640} height={640} className="object-contain" unoptimized />
        </div>
        <p className="cb-skill-popup-copy">
          Check the skills on your Career Passport. Tick 3, then record 3 on camera.
        </p>
        <button type="button" className="cb-skill-popup-cta" onClick={go}>
          <span>Skill Assessment</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7v10h10M7 7l10 10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
