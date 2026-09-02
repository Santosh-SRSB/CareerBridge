import type { ResumeContent } from '@careerbridge/shared';

export function LiveResumeSheet({
  content,
  photoUrl,
  withPhoto,
  stage,
  targetJobTitle,
}: {
  content: ResumeContent;
  photoUrl?: string | null;
  withPhoto: boolean;
  stage: number;
  targetJobTitle?: string | null;
}) {
  const showHeader = stage >= 1;
  const showAbout = stage >= 2;
  const showExperience = stage >= 3;
  const showEducation = stage >= 4;
  const showSkills = stage >= 5;

  return (
    <article className="cb-live-paper">
      {showHeader ? (
        <header className="cb-live-head">
          {withPhoto ? (
            <div className="cb-live-photo">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="" />
              ) : (
                <span>{(content.fullName || 'P').slice(0, 1)}</span>
              )}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="cb-live-kicker">{targetJobTitle || 'Professional Resume'}</p>
            <h2>{content.fullName || 'Your name'}</h2>
            <p className="cb-live-meta">
              {[content.city, content.phone].filter(Boolean).join('  ·  ') || 'Contact details coming in...'}
            </p>
          </div>
        </header>
      ) : (
        <div className="cb-live-blank" />
      )}

      {showAbout ? (
        <section>
          <h3>About</h3>
          <p>{content.summary || 'A short professional summary will appear here.'}</p>
        </section>
      ) : null}

      {showExperience ? (
        <section>
          <h3>Experience</h3>
          {content.experiences.length ? (
            content.experiences.map((item) => (
              <div key={`${item.company}-${item.jobTitle}`} className="cb-live-item">
                <p className="font-bold">{item.jobTitle}</p>
                <p className="text-sm text-muted">
                  {item.company}
                  {item.isInternship ? ' · Internship' : ''}
                </p>
                {item.description ? <p className="mt-1 text-sm">{item.description}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">Experience will appear here.</p>
          )}
        </section>
      ) : null}

      {showEducation ? (
        <section>
          <h3>Education</h3>
          {content.education.length ? (
            content.education.map((item) => (
              <p key={`${item.qualification}-${item.institution}`} className="cb-live-item">
                <span className="font-semibold">{item.qualification}</span>
                {item.institution ? ` · ${item.institution}` : ''}
                {item.yearCompleted ? ` · ${item.yearCompleted}` : ''}
              </p>
            ))
          ) : (
            <p className="text-sm text-muted">Education will appear here.</p>
          )}
        </section>
      ) : null}

      {showSkills ? (
        <>
          <section>
            <h3>Skills</h3>
            {content.skills.length ? (
              <div className="cb-live-chips">
                {content.skills.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">Skills will appear here.</p>
            )}
          </section>
          {content.languages.length ? (
            <section>
              <h3>Languages</h3>
              <p className="text-sm">{content.languages.join(' · ')}</p>
            </section>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
