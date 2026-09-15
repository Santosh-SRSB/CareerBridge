import React from "react";
import {
  contactNodes,
  dateRange,
  nonEmptyList,
  projectBulletTexts,
  projectTechnologies,
  visibleBullets,
} from "./helpers.js";

function ContactLineTemplate01({ data }) {
  const nodes = contactNodes(data, " | ");
  if (!nodes.length) return null;
  return (
    <p className="rt01-contact">
      {nodes.map((node, i) => (
        <span key={`${node.value}-${i}`}>
          {node.href ? (
            <a className="resume-link" href={node.href} target="_blank" rel="noreferrer">
              {node.label}
            </a>
          ) : (
            node.label
          )}
          {node.separator}
        </span>
      ))}
    </p>
  );
}

function educationDegreeLine(ed) {
  const degree = ed.degree || "";
  const field = ed.fieldOfStudy || ed.field || "";
  if (degree && field) return `${degree} in ${field}`;
  return degree || field || ed.level || "Education";
}

export function Template01Header({ data }) {
  return (
    <header>
      <h1>{data.fullName || "Your Name"}</h1>
      <ContactLineTemplate01 data={data} />
    </header>
  );
}

export function Template01Summary({ data }) {
  if (!data.summary) return null;
  return (
    <section>
      <h2>Summary</h2>
      <p className="rt01-summary">{data.summary}</p>
    </section>
  );
}

export function Template01Experience({ data }) {
  if (!nonEmptyList(data.experience)) return null;
  return (
    <section>
      <h2>Experience</h2>
      {data.experience.map((job, i) => {
        const dates = dateRange(job.startDate, job.endDate, job.current);
        const bullets = visibleBullets(job.bullets);
        const companyLine = [job.company, job.location].filter(Boolean).join(", ");
        const role = String(job.role || "Role").trim();
        return (
          <div className="rt01-entry" key={i}>
            <div className="rt01-row">
              <strong className="rt01-role">{role}</strong>
              {dates ? <span className="rt01-dates">{dates}</span> : null}
            </div>
            {companyLine ? <p className="rt01-sub">{companyLine}</p> : null}
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

export function Template01TechnicalSkills({ data }) {
  const groups = nonEmptyList(data.technicalSkills)
    ? data.technicalSkills.filter((g) => g.category || nonEmptyList(g.skills))
    : nonEmptyList(data.skills)
      ? [{ category: "", skills: data.skills }]
      : [];
  if (!groups.length) return null;
  return (
    <section>
      <h2>Technical Skills</h2>
      <div className="rt01-skills">
        {groups.map((group, i) => (
          <p className="rt01-skills-line" key={i}>
            {group.category ? (
              <>
                <strong>{group.category}:</strong> {group.skills.join(", ")}
              </>
            ) : (
              group.skills.join(", ")
            )}
          </p>
        ))}
      </div>
    </section>
  );
}

export function Template01Education({ data }) {
  if (!nonEmptyList(data.education)) return null;
  return (
    <section>
      <h2>Education</h2>
      {data.education.map((ed, i) => {
        const heading = educationDegreeLine(ed);
        const years = dateRange(ed.startDate, ed.endDate, false);
        const place = [ed.institution || ed.school, ed.location].filter(Boolean).join(", ");
        const grade = ed.grade || ed.gpa || "";
        return (
          <div className="rt01-entry" key={ed.id || `education-${i}`}>
            <div className="rt01-row">
              <strong>{heading}</strong>
              {years ? <span className="rt01-dates">{years}</span> : null}
            </div>
            {(place || grade) && (
              <div className="rt01-row">
                {place ? <span className="rt01-sub">{place}</span> : <span />}
                {grade ? <span className="rt01-edu-grade">{grade}</span> : null}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function Template01Projects({ data }) {
  if (!nonEmptyList(data.projects)) return null;
  const projects = data.projects.filter((p) => {
    const bullets = projectBulletTexts(p);
    const techs = projectTechnologies(p);
    return p.name || p.title || p.description || bullets.length || techs.length;
  });
  if (!projects.length) return null;
  return (
    <section>
      <h2>Projects</h2>
      {projects.map((p, i) => {
        const bullets = projectBulletTexts(p);
        const techs = projectTechnologies(p);
        const title = p.name || p.title;
        let overview = String(p.description || "").trim();
        if (techs.length && overview) {
          overview = overview
            .replace(
              /(?:^|\n)\s*(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*.+$/gim,
              "",
            )
            .replace(
              /\b(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*[^.]+$/i,
              "",
            )
            .trim();
        }
        return (
          <div className="rt01-entry" key={p.id || i}>
            {title && (
              <p className="rt01-project-title">
                <strong>{title}</strong>
                {techs.length > 0 && (
                  <>
                    {" "}
                    | <span className="rt01-project-tech">{techs.join(", ")}</span>
                  </>
                )}
              </p>
            )}
            {overview ? <p className="rt01-project-desc">{overview}</p> : null}
            {bullets.length > 0 ? (
              <ul>
                {bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

export function Template01Languages({ data }) {
  const languages = (data.languages || []).filter((lang) => {
    if (typeof lang === "string") return Boolean(lang.trim());
    return Boolean(lang?.name || lang?.language);
  });
  if (!languages.length) return null;
  return (
    <section>
      <h2>Languages</h2>
      <p className="rt01-languages">
        {languages
          .map((lang) => {
            if (typeof lang === "string") return lang.trim();
            const name = lang.name || lang.language || "";
            const level = lang.level || lang.proficiency || lang.description || "";
            return level ? `${name} — ${level}` : name;
          })
          .filter(Boolean)
          .join("  ·  ")}
      </p>
    </section>
  );
}

export function Template01Achievements({ data }) {
  const achievements = (data.achievements || []).filter((a) => {
    const text = [a.title, a.organization, a.description].filter(Boolean).join(" — ");
    if (!text.trim()) return false;
    const marker = text
      .trim()
      .replace(/[-–—•|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (/^(page\s+)?\d+\s*of\s*\d+$/i.test(marker.replace(/\s+/g, ""))) return false;
    if (/^(page\s+)?\d+\s+of\s+\d+$/i.test(marker)) return false;
    return true;
  });
  if (!achievements.length) return null;
  return (
    <section>
      <h2>Achievements</h2>
      <ul>
        {achievements.map((a, i) => {
          const text = [a.title, a.organization, a.description].filter(Boolean).join(" — ");
          return (
            <li key={a.id || `ach-${i}`}>
              <div className="rt01-ach-row">
                <span>{text}</span>
                {a.date ? <span className="rt01-dates">{a.date}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Template01Certifications({ data }) {
  const certs = (data.certifications || [])
    .map((c) => {
      if (typeof c === "string") return { name: c, issuer: "", date: "" };
      return c;
    })
    .filter((c) => c.name || c.issuer);
  if (!certs.length) return null;
  return (
    <section>
      <h2>Certifications</h2>
      <ul>
        {certs.map((c, i) => {
          const name = String(c.name || "").trim();
          const issuer = String(c.issuer || "").trim();
          const date = String(c.date || "").trim();
          let text = name;
          if (name && issuer && date) text = `${name} — ${issuer} (${date})`;
          else if (name && issuer) text = `${name} — ${issuer}`;
          else if (name && date) text = `${name} (${date})`;
          else if (issuer && date) text = `${issuer} (${date})`;
          else text = name || issuer;
          if (!text) return null;
          return (
            <li key={c.id || `cert-${i}`}>
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** @deprecated Prefer Template01Achievements + Template01Certifications. Kept for older callers. */
export function Template01AchievementsCertifications({ data }) {
  return (
    <>
      <Template01Achievements data={data} />
      <Template01Certifications data={data} />
    </>
  );
}
