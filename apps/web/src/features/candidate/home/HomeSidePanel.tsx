'use client';

import { ProfileRail } from '@/components/CandidatePortal';

type Props = {
  name: string;
  city: string;
  percentage: number;
  skills: string[];
  resumeScore: number | null;
  interviewScore: number | null;
  passportId: string;
  photoUrl?: string | null;
};

export function HomeSidePanel(props: Props) {
  return (
    <aside className="cb-home-side-panel cb-dash-pro-sidebar hidden lg:flex" aria-label="Side panel">
      <ProfileRail {...props} />
    </aside>
  );
}

export function HomeSidePanelMobile(props: Props) {
  return (
    <div className="cb-home-side-panel-mobile lg:hidden">
      <ProfileRail {...props} showNav={false} />
    </div>
  );
}
