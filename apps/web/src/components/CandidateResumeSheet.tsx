'use client';

import type { CandidateProfile } from '@careerbridge/shared';

function pretty(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatRange(start: string | null | undefined, end: string | null | undefined, current?: boolean) {
  const from = start ? pretty(start) : '';
  const to = current ? 'Present' : end ? pretty(end) : '';
  if (!from && !to) return '';
  return [from, to].filter(Boolean).join(' – ');
}

type Props = {
  profile: CandidateProfile;
  title?: string;
  note?: string;
};

export function CandidateResumeSheet({ profile, title = 'Your resume draft', note }: Props) {
  const name = pretty([profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your name');
  const contact = [profile.city, profile.phone, profile.email].filter(Boolean).join(' · ');
  const missing: string[] = [];
  if (!profile.firstName) missing.push('Name');
  if (!profile.education.length && !profile.highestEducation) missing.push('Education');
  if (!profile.skills.length) missing.push('Skills');
  if (!profile.experiences.length && profile.hasExperience !== 'NONE') missing.push('Experience details');
  if (!profile.careerInterests.length) missing.push('Career preferences');
  if (!profile.projects?.length) missing.push('Projects');
  if (!profile.certifications?.length) missing.push('Certifications');

  return (
    <article className="cb-resume-sheet">
      <header className="cb-resume-sheet-head">
        <div>
          <p className="cb-resume-kicker">{title}</p>
          <h1>{name}</h1>
          {contact ? <p className="cb-resume-contact">{contact}</p> : null}
        </div>
        {profile.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.photoUrl} alt="" className="cb-resume-photo" />
        ) : null}
      </header>

      {note ? <p className="cb-resume-note">{note}</p> : null}

      {missing.length ? (
        <p className="cb-resume-missing">
          Still missing: {missing.join(', ')}. You can fill these in the next steps or skip for now.
        </p>
      ) : null}

      {profile.gapMonths && profile.gapMonths > 0 ? (
        <section className="cb-resume-block">
          <h2>Career gap</h2>
          <p>
            {profile.gapMonths} month{profile.gapMonths === 1 ? '' : 's'}
            {profile.gapReason ? ` — ${profile.gapReason}` : ''}
          </p>
        </section>
      ) : profile.gapReason ? (
        <section className="cb-resume-block">
          <h2>Career gap</h2>
          <p>{profile.gapReason}</p>
        </section>
      ) : null}

      <section className="cb-resume-block">
        <h2>Education</h2>
        {profile.education.length ? (
          <ul>
            {profile.education.map((item) => (
              <li key={item.id}>
                <strong>{pretty(item.qualification)}</strong>
                {item.institution ? ` · ${pretty(item.institution)}` : ''}
                {item.fieldOfStudy ? ` · ${pretty(item.fieldOfStudy)}` : ''}
                <span className="cb-resume-meta">
                  {formatRange(item.startDate, item.endDate || (item.yearCompleted ? String(item.yearCompleted) : null))}
                </span>
              </li>
            ))}
          </ul>
        ) : profile.highestEducation ? (
          <p>{pretty(profile.highestEducation)}</p>
        ) : (
          <p className="is-empty">Not added yet</p>
        )}
      </section>

      <section className="cb-resume-block">
        <h2>Skills</h2>
        {profile.skills.length ? (
          <div className="cb-resume-tags">
            {profile.skills.map((item) => (
              <span key={item.id}>{pretty(item.name)}</span>
            ))}
          </div>
        ) : (
          <p className="is-empty">Not added yet</p>
        )}
      </section>

      <section className="cb-resume-block">
        <h2>Experience</h2>
        {profile.hasExperience === 'NONE' ? (
          <p>Fresher — no work experience yet</p>
        ) : profile.experiences.length ? (
          <ul>
            {profile.experiences.map((item) => (
              <li key={item.id}>
                <strong>{pretty(item.jobTitle)}</strong>
                {item.company ? ` · ${pretty(item.company)}` : ''}
                {item.isInternship ? ' (Internship)' : ''}
                <span className="cb-resume-meta">
                  {formatRange(item.startDate, item.endDate, item.stillInCompany)}
                </span>
                {item.description ? <p>{item.description}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="is-empty">Not added yet</p>
        )}
      </section>

      {(profile.projects?.length || 0) > 0 ? (
        <section className="cb-resume-block">
          <h2>Projects</h2>
          <ul>
            {profile.projects.map((item) => (
              <li key={item.id}>
                <strong>{pretty(item.title)}</strong>
                {item.role ? ` · ${pretty(item.role)}` : ''}
                {item.year ? ` · ${item.year}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(profile.certifications?.length || 0) > 0 ? (
        <section className="cb-resume-block">
          <h2>Certifications</h2>
          <ul>
            {profile.certifications.map((item) => (
              <li key={item.id}>
                <strong>{pretty(item.name)}</strong>
                {item.issuer ? ` · ${item.issuer}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
