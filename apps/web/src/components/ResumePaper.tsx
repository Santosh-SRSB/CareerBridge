import type { ResumeContent } from '@careerbridge/shared';

export function ResumePaper({
  content,
  summary,
  targetJobTitle,
  highlightSnippets = [],
  problemSections = [],
}: {
  content: ResumeContent;
  summary?: string;
  targetJobTitle?: string | null;
  highlightSnippets?: string[];
  problemSections?: string[];
}) {
  const body = summary ?? content.summary;
  const mark = (text: string) => <MarkedText text={text} snippets={highlightSnippets} />;
  const problem = (key: string) => (problemSections.includes(key) ? ' cb-resume-section-problem' : '');

  return (
    <article className="cb-resume-paper relative mx-auto w-full max-w-[720px] rounded-sm px-4 py-6 text-primary sm:px-10 sm:py-10">
      <div className="h-1.5 w-24 rounded-pill bg-orange" />
      <header className={`mt-5 border-b border-primary/10 pb-5${problem('contact')}`}>
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{content.fullName || 'Your name'}</h2>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-orange">
          {targetJobTitle || 'Professional Resume'}
        </p>
        <p className="mt-2 text-sm text-muted">
          {mark([content.city, content.phone].filter(Boolean).join('  ·  ') || 'Add contact details in your Career Passport')}
        </p>
      </header>

      <section className={`mt-6${problem('summary')}`}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Professional Summary</h3>
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-primary/90">
          {mark(body || 'Write a short summary of your strengths and the work you want.')}
        </p>
      </section>

      <section className={`mt-6${problem('skills')}`}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Skills</h3>
        {content.skills.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {content.skills.map((skill) => (
              <span
                key={skill}
                className={`rounded-pill px-3 py-1 text-xs font-semibold ring-1 ${
                  snippetHits(skill, highlightSnippets)
                    ? 'cb-resume-mark ring-red-200'
                    : 'bg-primary/5 text-primary ring-primary/10'
                }`}
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Add skills in your Career Passport.</p>
        )}
      </section>

      <section className={`mt-6${problem('experience')}`}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Experience</h3>
        {content.experiences.length ? (
          <div className="mt-3 space-y-4">
            {content.experiences.map((item) => (
              <div key={`${item.company}-${item.jobTitle}`}>
                <p className="font-bold">{mark(item.jobTitle)}</p>
                <p className="text-sm text-muted">
                  {mark(item.company)}
                  {item.isInternship ? ' · Internship' : ''}
                </p>
                {item.description ? <p className="mt-1 text-sm leading-6">{mark(item.description)}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Add work or internship experience to strengthen this resume.</p>
        )}
      </section>

      <section className={`mt-6${problem('education')}`}>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Education</h3>
        {content.education.length ? (
          <div className="mt-3 space-y-2">
            {content.education.map((item) => (
              <p key={`${item.qualification}-${item.institution}`}>
                <span className="font-semibold">{mark(item.qualification)}</span>
                {item.institution ? <> · {mark(item.institution)}</> : ''}
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

function snippetHits(text: string, snippets: string[]) {
  const hay = text.toLowerCase();
  return snippets.some((item) => item.trim().length > 3 && hay.includes(item.trim().toLowerCase()));
}

function MarkedText({ text, snippets }: { text: string; snippets: string[] }) {
  const needles = snippets.map((item) => item.trim()).filter((item) => item.length > 3);
  if (!needles.length) return <>{text}</>;

  const lower = text.toLowerCase();
  const ranges: Array<{ start: number; end: number }> = [];
  for (const needle of needles) {
    const hit = needle.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(hit, from);
      if (at < 0) break;
      ranges.push({ start: at, end: at + hit.length });
      from = at + hit.length;
    }
  }
  if (!ranges.length) return <>{text}</>;

  ranges.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const nodes = [];
  let cursor = 0;
  merged.forEach((range, index) => {
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(
      <mark key={`${range.start}-${index}`} className="cb-resume-mark">
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <>{nodes}</>;
}
