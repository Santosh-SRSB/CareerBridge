'use client';

type Props = {
  onBuildResume: () => void;
  onEnhanceResume: () => void;
};

export function HomeDashboardSection({ onBuildResume, onEnhanceResume }: Props) {
  return (
    <section className="cb-home-resume-hero" aria-labelledby="home-resume-title">
      <div className="cb-home-resume-hero__copy">
        <p className="cb-home-resume-hero__kicker">Resume</p>
        <h2 id="home-resume-title" className="cb-home-resume-hero__title">
          Good knowledge will clear the interview.
          <span className="cb-home-resume-hero__break">
            But a <em className="cb-home-resume-hero__mark">best ATS resume</em> will take you to
            that job.
          </span>
        </h2>
        <p className="cb-home-resume-hero__lead">
          Build a clean, ATS-friendly resume from your Career Passport so recruiters actually see you.
        </p>
        <div className="cb-home-resume-hero__actions">
          <button type="button" className="cb-home-btn cb-home-btn--primary" onClick={onBuildResume}>
            Build ATS resume
          </button>
          <button type="button" className="cb-home-btn cb-home-btn--outline" onClick={onEnhanceResume}>
            Enhance resume
          </button>
        </div>
      </div>

      <div className="cb-home-resume-paper" aria-hidden="true">
        <div className="cb-home-resume-paper__sheet">
          <span className="cb-home-resume-paper__header" />
          <span className="cb-home-resume-paper__line" />
          <span className="cb-home-resume-paper__line cb-home-resume-paper__line--short" />
          <span className="cb-home-resume-paper__line" />
          <span className="cb-home-resume-paper__line cb-home-resume-paper__line--mid" />
          <span className="cb-home-resume-paper__block" />
          <span className="cb-home-resume-paper__line" />
          <span className="cb-home-resume-paper__line cb-home-resume-paper__line--short" />
          <span className="cb-home-resume-paper__stamp">ATS</span>
        </div>
      </div>

      <aside className="cb-home-resume-hero__aside" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mascots/srsb-eagle-final-cut.png"
          alt=""
          className="cb-home-resume-hero__mascot"
        />
      </aside>
    </section>
  );
}
