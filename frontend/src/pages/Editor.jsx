import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { getTemplateComponent, resolveTemplateId } from "../templates/index.js";
import TemplatePreview from "../templates/TemplatePreview.jsx";
import {
  EDUCATION_LEVELS,
  applyEducationPatch,
  blankEducation,
  normalizeEducationList,
} from "../templates/helpers.js";

const EMPTY_EXPERIENCE = { company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] };
const EMPTY_PROJECT = { name: "", description: "", link: "" };
const EMPTY_CERT = { name: "", issuer: "", date: "" };

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [resume, setResume] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, t] = await Promise.all([api.getResume(id), api.templates()]);
        setResume({
          ...r,
          templateId: resolveTemplateId(r.templateId),
          data: {
            ...(r.data || {}),
            education: normalizeEducationList(r.data?.education),
          },
        });
        setTemplates(t);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  const updateData = useCallback((patch) => {
    setResume((prev) => ({ ...prev, data: { ...prev.data, ...patch } }));
    setStatus("");
  }, []);

  function updateTitle(title) {
    setResume((prev) => ({ ...prev, title }));
    setStatus("");
  }

  function selectTemplate(templateId) {
    setResume((prev) => ({ ...prev, templateId }));
    setStatus("");
    requestAnimationFrame(() => {
      const card = document.getElementById(`template-card-${templateId}`);
      if (card) card.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }

  // Generic helpers for list fields (experience, education, projects, certifications)
  function updateList(field, index, patch) {
    setResume((prev) => {
      const list = [...(prev.data[field] || [])];
      list[index] = { ...list[index], ...patch };
      return { ...prev, data: { ...prev.data, [field]: list } };
    });
    setStatus("");
  }
  function addListItem(field, blank) {
    setResume((prev) => ({
      ...prev,
      data: { ...prev.data, [field]: [...(prev.data[field] || []), blank] },
    }));
  }
  function removeListItem(field, index) {
    setResume((prev) => {
      const list = [...(prev.data[field] || [])];
      list.splice(index, 1);
      return { ...prev, data: { ...prev.data, [field]: list } };
    });
  }

  function updateEducation(id, patch) {
    setResume((prev) => {
      const list = (prev.data.education || []).map((ed) =>
        ed.id === id ? applyEducationPatch(ed, patch) : ed
      );
      return { ...prev, data: { ...prev.data, education: list } };
    });
    setStatus("");
  }

  function addEducation() {
    setResume((prev) => ({
      ...prev,
      data: { ...prev.data, education: [...(prev.data.education || []), blankEducation()] },
    }));
    setStatus("");
  }

  function removeEducation(id) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        education: (prev.data.education || []).filter((ed) => ed.id !== id),
      },
    }));
    setStatus("");
  }

  function updateBullet(expIndex, bulletIndex, value) {
    setResume((prev) => {
      const experience = [...prev.data.experience];
      const bullets = [...experience[expIndex].bullets];
      bullets[bulletIndex] = value;
      experience[expIndex] = { ...experience[expIndex], bullets };
      return { ...prev, data: { ...prev.data, experience } };
    });
  }
  function addBullet(expIndex) {
    setResume((prev) => {
      const experience = [...prev.data.experience];
      experience[expIndex] = { ...experience[expIndex], bullets: [...experience[expIndex].bullets, ""] };
      return { ...prev, data: { ...prev.data, experience } };
    });
  }
  function removeBullet(expIndex, bulletIndex) {
    setResume((prev) => {
      const experience = [...prev.data.experience];
      const bullets = [...experience[expIndex].bullets];
      bullets.splice(bulletIndex, 1);
      experience[expIndex] = { ...experience[expIndex], bullets };
      return { ...prev, data: { ...prev.data, experience } };
    });
  }

  const [skillDraft, setSkillDraft] = useState("");

  function addSkill(rawValue) {
    const value = rawValue.trim();
    if (!value) return;
    setResume((prev) => {
      const existing = prev.data.skills || [];
      if (existing.some((s) => s.toLowerCase() === value.toLowerCase())) return prev;
      return { ...prev, data: { ...prev.data, skills: [...existing, value] } };
    });
    setStatus("");
  }
  function removeSkill(index) {
    setResume((prev) => {
      const skills = [...(prev.data.skills || [])];
      skills.splice(index, 1);
      return { ...prev, data: { ...prev.data, skills } };
    });
    setStatus("");
  }
  function handleSkillKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addSkill(skillDraft);
      setSkillDraft("");
    } else if (e.key === "Backspace" && skillDraft === "" && (resume.data.skills || []).length > 0) {
      // Backspace on an empty field removes the last pill, like most tag inputs.
      removeSkill(resume.data.skills.length - 1);
    }
  }
  function handleSkillBlur() {
    if (skillDraft.trim()) {
      addSkill(skillDraft);
      setSkillDraft("");
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateResume(resume.id, {
        title: resume.title,
        templateId: resume.templateId,
        data: {
          ...resume.data,
          education: normalizeEducationList(resume.data.education),
        },
      });
      setResume({
        ...updated,
        templateId: resolveTemplateId(updated.templateId),
        data: {
          ...(updated.data || {}),
          education: normalizeEducationList(updated.data?.education),
        },
      });
      setStatus("Saved");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handlePhotoChange(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setPhotoError("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Profile photo must be 5 MB or smaller.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoError("");
      updateData({ photo: reader.result });
    };
    reader.onerror = () => {
      setPhotoError("Could not read that image. Please try another file.");
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoError("");
    updateData({ photo: null });
  }

  if (error && !resume) {
    return (
      <div className="editor-error">
        <p className="alert">{error}</p>
        <button className="btn" onClick={() => navigate("/")}>Back to dashboard</button>
      </div>
    );
  }
  if (!resume) return <p className="muted">Loading…</p>;

  const TemplateComponent = getTemplateComponent(resume.templateId);
  const activeTemplate = templates.find((t) => t.id === resume.templateId);
  const photoTemplates = templates.filter((t) => t.hasPhoto);
  const textTemplates = templates.filter((t) => !t.hasPhoto);

  return (
    <div className="editor">
      <div className="editor-toolbar no-print">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>&larr; Dashboard</button>
        <input
          className="title-input"
          value={resume.title}
          onChange={(e) => updateTitle(e.target.value)}
        />
        <div className="toolbar-actions">
          {status && <span className="save-status">{status}</span>}
          <button className="btn btn-ghost" onClick={handlePrint}>Export / Print PDF</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="alert no-print">{error}</div>}

      <div className="editor-body">
        <aside className="template-sidebar no-print" aria-label="Resume templates">
          <h2 className="template-sidebar-title">Resume templates</h2>
          <TemplateGroup
            heading="With photo"
            templates={photoTemplates}
            selectedId={resume.templateId}
            onSelect={selectTemplate}
            photoLabel="With Photo"
          />
          <TemplateGroup
            heading="Without photo"
            templates={textTemplates}
            selectedId={resume.templateId}
            onSelect={selectTemplate}
            photoLabel="Without Photo"
          />
          {activeTemplate && (
            <p className="muted small template-note">
              Content stays the same. Switching templates only changes the layout.
            </p>
          )}
        </aside>

        <div className="editor-form no-print">
          <section className="form-section">
            <h2>Basics</h2>
            <div className="grid-2">
              <label>Full name
                <input value={resume.data.fullName || ""} onChange={(e) => updateData({ fullName: e.target.value })} />
              </label>
              <label>Target role / title
                <input value={resume.data.title || ""} onChange={(e) => updateData({ title: e.target.value })} />
              </label>
              <label>Email
                <input value={resume.data.email || ""} onChange={(e) => updateData({ email: e.target.value })} />
              </label>
              <label>Phone
                <input value={resume.data.phone || ""} onChange={(e) => updateData({ phone: e.target.value })} />
              </label>
              <label>Location
                <input value={resume.data.location || ""} onChange={(e) => updateData({ location: e.target.value })} />
              </label>
              <label>LinkedIn / portfolio
                <input value={resume.data.linkedin || ""} onChange={(e) => updateData({ linkedin: e.target.value })} />
              </label>
            </div>
            <label>Summary
              <textarea
                rows={3}
                value={resume.data.summary || ""}
                onChange={(e) => updateData({ summary: e.target.value })}
              />
            </label>
            <div className="photo-upload">
              <span className="photo-upload-label" id="photo-upload-label">Profile photo</span>
              <p className="muted small">Optional. Shown on photo templates only. JPG, PNG, or WebP up to 5 MB.</p>
              <div className="photo-upload-row">
                {resume.data.photo ? (
                  <img className="photo-upload-preview" src={resume.data.photo} alt="Uploaded profile photo preview" />
                ) : (
                  <div className="photo-upload-placeholder" aria-hidden="true">No photo</div>
                )}
                <div className="photo-upload-actions">
                  <label className="btn btn-small photo-file-label">
                    {resume.data.photo ? "Replace image" : "Choose image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      aria-labelledby="photo-upload-label"
                    />
                  </label>
                  {resume.data.photo && (
                    <button className="btn btn-ghost btn-small" type="button" onClick={removePhoto}>
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
              {photoError && <p className="alert photo-upload-error">{photoError}</p>}
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Experience</h2>
              <button className="btn btn-small" type="button" onClick={() => addListItem("experience", { ...EMPTY_EXPERIENCE, bullets: [""] })}>+ Add</button>
            </div>
            {(resume.data.experience || []).map((job, i) => (
              <div className="list-item" key={i}>
                <div className="grid-2">
                  <label>Company
                    <input value={job.company} onChange={(e) => updateList("experience", i, { company: e.target.value })} />
                  </label>
                  <label>Role
                    <input value={job.role} onChange={(e) => updateList("experience", i, { role: e.target.value })} />
                  </label>
                  <label>Location
                    <input value={job.location} onChange={(e) => updateList("experience", i, { location: e.target.value })} />
                  </label>
                  <label>Start date
                    <input placeholder="Jan 2022" value={job.startDate} onChange={(e) => updateList("experience", i, { startDate: e.target.value })} />
                  </label>
                  <label>End date
                    <input placeholder="Mar 2024" disabled={job.current} value={job.endDate} onChange={(e) => updateList("experience", i, { endDate: e.target.value })} />
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={job.current} onChange={(e) => updateList("experience", i, { current: e.target.checked })} />
                    I currently work here
                  </label>
                </div>
                <div className="bullets">
                  <span className="muted small">Highlights</span>
                  {job.bullets.map((b, j) => (
                    <div className="bullet-row" key={j}>
                      <input value={b} onChange={(e) => updateBullet(i, j, e.target.value)} placeholder="Led a project that increased X by Y%" />
                      <button className="btn btn-ghost btn-icon" type="button" onClick={() => removeBullet(i, j)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addBullet(i)}>+ Bullet</button>
                </div>
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeListItem("experience", i)}>Remove this role</button>
              </div>
            ))}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Education</h2>
              <button className="btn btn-small" type="button" onClick={addEducation}>Add Education</button>
            </div>
            {(resume.data.education || []).map((ed, i) => (
              <div className="list-item education-card" key={ed.id}>
                <div className="education-card-head">
                  <h3>Education {i + 1}{ed.level ? ` — ${ed.level}` : ""}</h3>
                </div>
                <div className="grid-2">
                  <label>Education level
                    <select
                      value={ed.level || ""}
                      onChange={(e) => updateEducation(ed.id, { level: e.target.value })}
                    >
                      <option value="">Select level</option>
                      {EDUCATION_LEVELS.map((level) => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </label>
                  <label>Institution
                    <input
                      value={ed.institution || ""}
                      onChange={(e) => updateEducation(ed.id, { institution: e.target.value })}
                      placeholder="ABC High School"
                    />
                  </label>
                  <label>Degree / qualification
                    <input
                      value={ed.degree || ""}
                      onChange={(e) => updateEducation(ed.id, { degree: e.target.value })}
                      placeholder="B.Sc"
                    />
                  </label>
                  <label>Field of study
                    <input
                      value={ed.fieldOfStudy || ""}
                      onChange={(e) => updateEducation(ed.id, { fieldOfStudy: e.target.value })}
                      placeholder="Mathematics & Computer Science"
                    />
                  </label>
                  <label>Location
                    <input
                      value={ed.location || ""}
                      onChange={(e) => updateEducation(ed.id, { location: e.target.value })}
                      placeholder="Kolar, Karnataka"
                    />
                  </label>
                  <label>Grade / percentage
                    <input
                      value={ed.grade || ""}
                      onChange={(e) => updateEducation(ed.id, { grade: e.target.value })}
                      placeholder="8.2 CGPA"
                    />
                  </label>
                  <label>Start date
                    <input
                      placeholder="2018"
                      value={ed.startDate || ""}
                      onChange={(e) => updateEducation(ed.id, { startDate: e.target.value })}
                    />
                  </label>
                  <label>End date
                    <input
                      placeholder="2020"
                      value={ed.endDate || ""}
                      onChange={(e) => updateEducation(ed.id, { endDate: e.target.value })}
                    />
                  </label>
                </div>
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeEducation(ed.id)}>
                  Remove this education
                </button>
              </div>
            ))}
          </section>

          <section className="form-section">
            <h2>Skills</h2>
            <label>
              Type a skill, then press Enter or comma to add it
              <div className="skill-tag-input">
                {(resume.data.skills || []).map((s, i) => (
                  <span className="pill skill-tag" key={`${s}-${i}`}>
                    {s}
                    <button
                      type="button"
                      className="pill-remove"
                      onClick={() => removeSkill(i)}
                      aria-label={`Remove ${s}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  className="skill-tag-field"
                  value={skillDraft}
                  onChange={(e) => setSkillDraft(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  onBlur={handleSkillBlur}
                  placeholder={(resume.data.skills || []).length === 0 ? "React, Node.js, SQL…" : ""}
                />
              </div>
            </label>
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Projects</h2>
              <button className="btn btn-small" type="button" onClick={() => addListItem("projects", { ...EMPTY_PROJECT })}>+ Add</button>
            </div>
            {(resume.data.projects || []).map((p, i) => (
              <div className="list-item" key={i}>
                <div className="grid-2">
                  <label>Name
                    <input value={p.name} onChange={(e) => updateList("projects", i, { name: e.target.value })} />
                  </label>
                  <label>Link (optional)
                    <input value={p.link} onChange={(e) => updateList("projects", i, { link: e.target.value })} />
                  </label>
                </div>
                <label>Description
                  <textarea rows={2} value={p.description} onChange={(e) => updateList("projects", i, { description: e.target.value })} />
                </label>
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeListItem("projects", i)}>Remove</button>
              </div>
            ))}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Certifications</h2>
              <button className="btn btn-small" type="button" onClick={() => addListItem("certifications", { ...EMPTY_CERT })}>+ Add</button>
            </div>
            {(resume.data.certifications || []).map((c, i) => (
              <div className="list-item" key={i}>
                <div className="grid-2">
                  <label>Name
                    <input value={c.name} onChange={(e) => updateList("certifications", i, { name: e.target.value })} />
                  </label>
                  <label>Issuer
                    <input value={c.issuer} onChange={(e) => updateList("certifications", i, { issuer: e.target.value })} />
                  </label>
                  <label>Date
                    <input value={c.date} onChange={(e) => updateList("certifications", i, { date: e.target.value })} />
                  </label>
                </div>
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeListItem("certifications", i)}>Remove</button>
              </div>
            ))}
          </section>
        </div>

        <div className="editor-preview">
          <div className="preview-sheet" id="print-area">
            <TemplateComponent data={resume.data} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateGroup({ heading, templates, selectedId, onSelect, photoLabel }) {
  if (!templates.length) return null;
  return (
    <div className="template-category">
      <h3 className="template-category-title">{heading}</h3>
      <div className="template-grid">
        {templates.map((t) => {
          const selected = selectedId === t.id;
          return (
            <button
              key={t.id}
              id={`template-card-${t.id}`}
              type="button"
              className={`template-option ${selected ? "active" : ""}`}
              onClick={() => onSelect(t.id)}
              aria-pressed={selected}
              aria-label={`${t.name} template preview`}
            >
              <div className="template-thumb-wrap">
                <TemplatePreview id={t.id} />
              </div>
              <div className="template-option-head">
                <strong>{t.name}</strong>
                {selected && <span className="badge">Selected</span>}
              </div>
              <div className="template-badges">
                <span className="badge badge-good">ATS-friendly</span>
                <span className="badge badge-photo">{photoLabel}</span>
              </div>
              <p className="muted small">{t.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
