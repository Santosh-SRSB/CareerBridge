import type { ResumeContent } from '@careerbridge/shared';

export function ResumePaper({
  content,
  summary,
  targetJobTitle,
}: {
  content: ResumeContent;
  summary?: string;
  targetJobTitle?: string | null;
}) {
  const body = summary ?? content.summary;

  return (
    <article className="cb-resume-paper relative mx-auto w-full max-w-[720px] rounded-sm px-4 py-6 text-primary sm:px-10 sm:py-10">
      <div className="h-1.5 w-24 rounded-pill bg-orange" />
      <header className="mt-5 border-b border-primary/10 pb-5">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{content.fullName || 'Your name'}</h2>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-orange">
          {targetJobTitle || 'Professional Resume'}
        </p>
        <p className="mt-2 text-sm text-muted">
          {[content.city, content.phone].filter(Boolean).join('  ·  ') || 'Add contact details in your Career Passport'}
        </p>
      </header>

      <section className="mt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Professional Summary</h3>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-primary/90">
          {body || 'Write a short summary of your strengths and the work you want.'}
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Skills</h3>
        {content.skills.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {content.skills.map((skill) => (
              <span key={skill} className="rounded-pill bg-primary/5 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/10">
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Add skills in your Career Passport.</p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Experience</h3>
        {content.experiences.length ? (
          <div className="mt-3 space-y-4">
            {content.experiences.map((item) => (
              <div key={`${item.company}-${item.jobTitle}`}>
                <p className="font-bold">{item.jobTitle}</p>
                <p className="text-sm text-muted">
                  {item.company}
                  {item.isInternship ? ' · Internship' : ''}
                </p>
                {item.description ? <p className="mt-1 text-sm leading-6">{item.description}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Add work or internship experience to strengthen this resume.</p>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Education</h3>
        {content.education.length ? (
          <div className="mt-3 space-y-2">
            {content.education.map((item) => (
              <p key={`${item.qualification}-${item.institution}`}>
                <span className="font-semibold">{item.qualification}</span>
                {item.institution ? ` · ${item.institution}` : ''}
                {item.yearCompleted ? ` · ${item.yearCompleted}` : ''}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Add your education in the Career Passport.</p>
        )}
      </section>

      {content.languages.length ? (
        <section className="mt-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Languages</h3>
          <p className="mt-2 text-sm">{content.languages.join(' · ')}</p>
        </section>
      ) : null}
    </article>
  );
}
