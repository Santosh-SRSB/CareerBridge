import React from "react";
import {
  contactLine,
  dateRange,
  educationHeading,
  educationMetaLine,
  educationPlaceLine,
  nonEmptyList,
  normalizeCertificateUrl,
  normalizeProjectUrl,
  projectBulletTexts,
  projectTechnologies,
  visibleBullets,
  careerGapDateRange,
  visibleCareerGapItems,
} from "./helpers.js";

export function ProfilePhoto({ src, variant = "circle" }) {
  if (!src) return null;
  return (
    <img
      className={`profile-photo profile-photo-${variant}`}
      src={src}
      alt="Profile photo"
    />
  );
}

export function ContactText({ data, separator = " | " }) {
  const line = contactLine(data, separator);
  if (!line) return null;
  return <p className="contact">{line}</p>;
}

export function SummarySection({ data, title = "Summary" }) {
  if (!data.summary) return null;
  return (
    <section>
      <h2>{title}</h2>
      <p>{data.summary}</p>
    </section>
  );
}

export function ExperienceSection({ data, title = "Experience", variant = "role-first" }) {
  if (!nonEmptyList(data.experience)) return null;
  return (
    <section>
      <h2>{title}</h2>
      {data.experience.map((job, i) => {
        const dates = dateRange(job.startDate, job.endDate, job.current);
        const bullets = visibleBullets(job.bullets);
        const companyLine = [job.company, job.location].filter(Boolean).join(", ");
        return (
          <div className="entry" key={i}>
            {variant === "company-first" ? (
              <>
                <div className="entry-head">
                  <strong>{job.company || "Company"}</strong>
                  {dates ? <span>{dates}</span> : null}
                </div>
                <div className="entry-sub italic">
                  {job.role}
                  {job.location ? ` — ${job.location}` : ""}
                </div>
              </>
            ) : (
              <>
                <div className="entry-head">
                  <strong>{job.role || "Role"}</strong>
                  {dates ? <span>{dates}</span> : null}
                </div>
                <div className="entry-sub">{companyLine}</div>
              </>
            )}
            {bullets.length > 0 && (
              <ul>
                {bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function EducationSection({ data, title = "Education" }) {
  if (!nonEmptyList(data.education)) return null;
  return (
    <section>
      <h2>{title}</h2>
      {data.education.map((ed, i) => {
        const heading = educationHeading(ed);
        const place = educationPlaceLine(ed);
        const meta = educationMetaLine(ed);
        return (
          <article className="edu-entry" key={ed.id || `education-${i}`}>
            <h3>{heading}</h3>
            {place ? <p>{place}</p> : null}
            {meta ? <p className="edu-meta">{meta}</p> : null}
          </article>
        );
      })}
    </section>
  );
}

export function SkillsSection({ data, title = "Skills" }) {
  if (!nonEmptyList(data.skills)) return null;
  return (
    <section>
      <h2>{title}</h2>
      <p>{data.skills.join(", ")}</p>
    </section>
  );
}

export function ProjectsSection({ data, title = "Projects" }) {
  if (!nonEmptyList(data.projects)) return null;
  const projects = data.projects.filter((p) => {
    const bullets = projectBulletTexts(p);
    const techs = projectTechnologies(p);
    return p.name || p.title || p.description || bullets.length || techs.length || p.url || p.link;
  });
  if (!projects.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      {projects.map((p, i) => {
        const bullets = projectBulletTexts(p);
        const techs = projectTechnologies(p);
        const urlInfo = normalizeProjectUrl(p.url || p.link || "");
        const href = urlInfo.ok ? urlInfo.href : "";
        const display = urlInfo.ok ? urlInfo.display : String(p.url || p.link || "").trim();
        const dates = dateRange(p.startDate, p.endDate, false);
        return (
          <div className="entry project-entry" key={p.id || i}>
            {(p.name || p.title || dates) ? (
              <div className="entry-head">
                <strong>{p.name || p.title}</strong>
                {dates ? <span>{dates}</span> : null}
              </div>
            ) : null}
            {p.description ? <p className="project-desc">{p.description}</p> : null}
            {bullets.length > 0 && (
              <ul>
                {bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            )}
            {techs.length > 0 && (
              <p className="entry-sub project-meta">Technologies: {techs.join(" | ")}</p>
            )}
            {display ? (
              <p className="entry-sub project-meta project-url">
                Project:{" "}
                {href ? (
                  <a className="resume-link" href={href}>
                    {display}
                  </a>
                ) : (
                  display
                )}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

export function CertificationsSection({ data, title = "Certifications" }) {
  if (!nonEmptyList(data.certifications)) return null;
  const certs = data.certifications.filter((c) => c.name || c.issuer || c.date || c.url || c.link);
  if (!certs.length) return null;
  return (
    <section className="cert-section">
      <h2>{title}</h2>
      <ul className="cert-list">
        {certs.map((c, i) => {
          const urlInfo = normalizeCertificateUrl(c.url || c.link || "");
          const href = urlInfo.ok ? urlInfo.href : "";
          const display = urlInfo.ok ? urlInfo.display : String(c.url || c.link || "").trim();
          return (
            <li className="cert-item" key={c.id || i}>
              {c.name}
              {c.issuer ? ` — ${c.issuer}` : ""}
              {c.date ? ` (${c.date})` : ""}
              {display ? (
                <span className="entry-sub cert-url">
                  Certificate:{" "}
                  {href ? (
                    <a className="resume-link" href={href}>
                      {display}
                    </a>
                  ) : (
                    display
                  )}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CareerGapSection({ data, title = "Career Break" }) {
  const source = data || {};
  const list = Array.isArray(source.careerGaps) && source.careerGaps.length
    ? source.careerGaps
    : Array.isArray(source.careerBreaks) ? source.careerBreaks : [];
  const visible = list.filter((gap) => {
    const items = visibleCareerGapItems(gap);
    return gap.type || gap.reason || gap.startDate || gap.startYear || gap.description
      || items.activities.length || items.skills.length || items.certifications.length || items.projects.length;
  });
  if (!visible.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      {visible.map((gap, i) => {
        const items = visibleCareerGapItems(gap);
        const heading = gap.type || gap.reason || "Career Break";
        const dates = careerGapDateRange(gap);
        return (
          <div className="entry project-entry" key={gap.id || i}>
            <div className="entry-head">
              <strong>{heading}</strong>
              {dates ? <span>{dates}</span> : null}
            </div>
            {gap.description ? <p>{gap.description}</p> : null}
            {items.activities.length > 0 && (
              <ul>
                {items.activities.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )}
            {items.skills.length > 0 && (
              <p className="entry-sub">Skills developed: {items.skills.join(" | ")}</p>
            )}
            {items.certifications.length > 0 && (
              <p className="entry-sub">Certifications: {items.certifications.join(" | ")}</p>
            )}
            {items.projects.length > 0 && (
              <p className="entry-sub">Projects: {items.projects.join(" | ")}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function StandardBody({ data, summaryTitle = "Summary", experienceTitle = "Experience", experienceVariant = "role-first" }) {
  return (
    <>
      <SummarySection data={data} title={summaryTitle} />
      <ExperienceSection data={data} title={experienceTitle} variant={experienceVariant} />
      <CareerGapSection data={data} />
      <EducationSection data={data} />
      <SkillsSection data={data} />
      <ProjectsSection data={data} />
      <CertificationsSection data={data} />
    </>
  );
}
