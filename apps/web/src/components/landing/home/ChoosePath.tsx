import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CandidateRoleIcon, EmployerRoleIcon } from "./icons";

export function ChoosePath() {
  return (
    <section className="hl-path" aria-labelledby="hl-path-title">
      <div className="hl-path__container">
        <div className="hl-section-head hl-section-head--center">
          <p className="hl-eyebrow">CareerBridge</p>
          <h2 id="hl-path-title" className="hl-section-title">
            Choose Your Path
          </h2>
          <p className="hl-section-lede">
            Whether you&apos;re looking to hire exceptional talent or build your career,
            CareerBridge helps you take the next step.
          </p>
        </div>

        <div className="hl-path__grid">
          <article className="hl-path-card hl-path-card--employer" id="employer">
            <div className="hl-path-card__content">
              <div className="hl-path-card__head">
                <span className="hl-path-card__icon">
                  <EmployerRoleIcon size={26} />
                </span>
                <h3 className="hl-path-card__title">Employer</h3>
              </div>
              <p className="hl-path-card__text">
                Post jobs and hire
                <br />
                verified talent.
              </p>
              <Link href="/employer/welcome" className="hl-explore hl-explore--employer">
                Explore<span className="sr-only"> for employers</span>
                <ArrowRightIcon size={18} />
              </Link>
            </div>
            <Image
              src="/landing/hero-professional.webp"
              alt=""
              width={640}
              height={718}
              className="hl-path-card__image"
            />
          </article>

          <article className="hl-path-card hl-path-card--candidate" id="candidate">
            <div className="hl-path-card__content">
              <div className="hl-path-card__head">
                <span className="hl-path-card__icon">
                  <CandidateRoleIcon size={26} />
                </span>
                <h3 className="hl-path-card__title">Candidate</h3>
              </div>
              <p className="hl-path-card__text">
                Build your passport
                <br />
                and find the right job.
              </p>
              <Link href="/welcome" className="hl-explore hl-explore--candidate">
                Explore<span className="sr-only"> for candidates</span>
                <ArrowRightIcon size={18} />
              </Link>
            </div>
            <Image
              src="/landing/candidate-student.webp"
              alt=""
              width={330}
              height={422}
              className="hl-path-card__image"
            />
          </article>
        </div>
        <div className="hl-path__bar" aria-hidden="true" />
        <p className="hl-path__foot">
          Two paths. One destination — <strong>Your future.</strong>
        </p>
      </div>
    </section>
  );
}
