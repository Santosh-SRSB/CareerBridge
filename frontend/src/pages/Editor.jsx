import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { getTemplateComponent, resolveTemplateId } from "../templates/index.js";
import TemplatePreview from "../templates/TemplatePreview.jsx";
import {
  EDUCATION_LEVELS,
  applyEducationPatch,
  applyProjectPatch,
  applyCareerGapPatch,
  blankCareerGap,
  blankCertification,
  blankEducation,
  blankProject,
  CAREER_GAP_TYPES,
  MONTHS,
  createProjectBulletId,
  normalizeCertificateUrl,
  normalizeCertificationList,
  normalizeCareerGapList,
  normalizeEducationList,
  normalizeProjectList,
  normalizeProjectUrl,
  projectTechnologies,
} from "../templates/helpers.js";
import AtsAnalysisPanel from "../components/AtsAnalysisPanel.jsx";
import { useResumePageFit, usePreviewScale, RESUME_PAGE } from "../templates/pageFit.js";

function analysisFingerprint(resume) {
  const data = { ...(resume.data || {}) };
  const hasPhoto = Boolean(data.photo);
  delete data.photo;
  return JSON.stringify({
    templateId: resume.templateId,
    hasPhoto,
    data,
  });
}

const EMPTY_EXPERIENCE = { company: "", role: "", location: "", startDate: "", endDate: "", current: false, bullets: [""] };

const FORM_STEPS = [
  { id: "personal", label: "Personal" },
  { id: "summary", label: "Summary" },
  { id: "education", label: "Education" },
  { id: "experience", label: "Experience" },
  { id: "career-gap", label: "Career Gap" },
  { id: "skills", label: "Skills" },
  { id: "projects", label: "Projects" },
  { id: "certifications", label: "Certifications" },
  { id: "review", label: "Review & ATS" },
];

function filled(value) {
  return Boolean(String(value || "").trim());
}

function sectionComplete(stepId, data) {
  const source = data || {};
  if (stepId === "personal") return filled(source.fullName) && filled(source.email) && filled(source.phone);
  if (stepId === "summary") return filled(source.summary);
  if (stepId === "education") {
    return (source.education || []).some((ed) => filled(ed.institution) || filled(ed.school) || filled(ed.degree));
  }
  if (stepId === "experience") {
    return (source.experience || []).some((job) => filled(job.role) || filled(job.company));
  }
  if (stepId === "career-gap") return true;
  if (stepId === "skills") return (source.skills || []).length > 0;
  if (stepId === "projects") {
    return (source.projects || []).some((p) => filled(p.name) || filled(p.description));
  }
  if (stepId === "certifications") {
    return (source.certifications || []).some((c) => filled(c.name));
  }
  return true;
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [resume, setResume] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [previousScore, setPreviousScore] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [analyzedFingerprint, setAnalyzedFingerprint] = useState("");
  const [projectUrlErrors, setProjectUrlErrors] = useState({});
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState("");
  const [rewriteResult, setRewriteResult] = useState(null);
  const [viewingRewrite, setViewingRewrite] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [editorStep, setEditorStep] = useState("personal");
  const [navError, setNavError] = useState("");
  const [certUrlErrors, setCertUrlErrors] = useState({});
  const sheetRef = useRef(null);
  const previewPaneRef = useRef(null);
  const { overfull } = useResumePageFit(sheetRef, [
    resume?.templateId,
    resume?.data,
    viewingRewrite,
    rewriteResult,
  ]);
  const previewScale = usePreviewScale(previewPaneRef, Boolean(resume));

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
            projects: normalizeProjectList(r.data?.projects),
            certifications: normalizeCertificationList(r.data?.certifications),
            careerGaps: normalizeCareerGapList(r.data?.careerGaps || r.data?.careerBreaks),
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
    const nextProjectErrors = {};
    for (const project of resume.data.projects || []) {
      const raw = project.url || project.link || "";
      if (!raw.trim()) continue;
      const checked = normalizeProjectUrl(raw);
      if (!checked.ok) nextProjectErrors[project.id] = checked.error;
    }
    const nextCertErrors = {};
    for (const cert of resume.data.certifications || []) {
      const raw = cert.url || cert.link || "";
      if (!raw.trim()) continue;
      const checked = normalizeCertificateUrl(raw);
      if (!checked.ok) nextCertErrors[cert.id] = checked.error;
    }
    setProjectUrlErrors(nextProjectErrors);
    setCertUrlErrors(nextCertErrors);
    if (Object.keys(nextProjectErrors).length || Object.keys(nextCertErrors).length) {
      setError("Please enter a valid URL, or leave the optional URL fields empty.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await api.updateResume(resume.id, {
        title: resume.title,
        templateId: resume.templateId,
        data: {
          ...resume.data,
          education: normalizeEducationList(resume.data.education),
          projects: normalizeProjectList(resume.data.projects),
          certifications: normalizeCertificationList(resume.data.certifications),
          careerGaps: normalizeCareerGapList(resume.data.careerGaps),
        },
      });
      setResume({
        ...updated,
        templateId: resolveTemplateId(updated.templateId),
        data: {
          ...(updated.data || {}),
          education: normalizeEducationList(updated.data?.education),
          projects: normalizeProjectList(updated.data?.projects),
          certifications: normalizeCertificationList(updated.data?.certifications),
          careerGaps: normalizeCareerGapList(updated.data?.careerGaps || updated.data?.careerBreaks),
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

  async function handleAnalyze() {
    const role = (resume.data.targetRole || "").trim();
    if (!role) {
      setAnalyzeError("Enter a target job role to analyze your resume.");
      return;
    }
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const result = await api.analyzeResume({
        resume: {
          ...resume.data,
          photo: resume.data.photo ? "present" : "",
          education: normalizeEducationList(resume.data.education),
          projects: normalizeProjectList(resume.data.projects),
          certifications: normalizeCertificationList(resume.data.certifications),
          careerGaps: normalizeCareerGapList(resume.data.careerGaps),
        },
        templateId: resume.templateId,
        targetRole: role,
        jobDescription: resume.data.jobDescription || "",
      });
      setPreviousScore(analysis ? analysis.overallScore : null);
      setAnalysis(result);
      setAnalyzedFingerprint(analysisFingerprint(resume));
    } catch (err) {
      setAnalyzeError(err.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleRewrite() {
    const role = (resume.data.targetRole || "").trim();
    if (!role) {
      setRewriteError("Enter a target job role before rewriting your resume.");
      return;
    }
    setRewriting(true);
    setRewriteError("");
    try {
      const result = await api.rewriteResume(resume.id, {
        resume: {
          ...resume.data,
          photo: resume.data.photo ? "present" : "",
          education: normalizeEducationList(resume.data.education),
          projects: normalizeProjectList(resume.data.projects),
          certifications: normalizeCertificationList(resume.data.certifications),
          careerGaps: normalizeCareerGapList(resume.data.careerGaps),
        },
        templateId: resume.templateId,
        targetRole: role,
        jobDescription: resume.data.jobDescription || "",
        analysis,
      });
      setRewriteResult(result);
      setViewingRewrite(false);
    } catch (err) {
      setRewriteError(err.message);
    } finally {
      setRewriting(false);
    }
  }

  async function handleApplyRewrite() {
    if (!rewriteResult?.rewrittenResume) return;
    setUndoSnapshot({ ...(resume.data || {}) });
    const rewritten = rewriteResult.rewrittenResume;
    const nextData = {
      ...rewritten,
      photo: resume.data.photo,
      targetRole: resume.data.targetRole,
      jobDescription: resume.data.jobDescription,
      education: normalizeEducationList(rewritten.education),
      projects: normalizeProjectList(rewritten.projects),
      certifications: normalizeCertificationList(rewritten.certifications),
      careerGaps: normalizeCareerGapList(rewritten.careerGaps || rewritten.careerBreaks),
    };
    setResume((prev) => ({ ...prev, data: nextData }));
    setRewriteResult(null);
    setViewingRewrite(false);
    setAnalysis(null);
    try {
      await api.updateResume(resume.id, {
        title: resume.title,
        templateId: resume.templateId,
        data: nextData,
      });
      setStatus("Resume updated successfully.");
    } catch (err) {
      setStatus("Rewrite applied in the editor — click Save to keep it.");
      setError(err.message);
    }
  }

  function handleUndoRewrite() {
    if (!undoSnapshot) return;
    setResume((prev) => ({
      ...prev,
      data: {
        ...undoSnapshot,
        education: normalizeEducationList(undoSnapshot.education),
        projects: normalizeProjectList(undoSnapshot.projects),
        certifications: normalizeCertificationList(undoSnapshot.certifications),
        careerGaps: normalizeCareerGapList(undoSnapshot.careerGaps || undoSnapshot.careerBreaks),
      },
    }));
    setUndoSnapshot(null);
    setAnalysis(null);
    setStatus("Rewrite undone");
  }

  function updateProject(id, patch) {
    setResume((prev) => {
      const list = (prev.data.projects || []).map((project) =>
        project.id === id ? applyProjectPatch(project, patch) : project
      );
      return { ...prev, data: { ...prev.data, projects: list } };
    });
    setStatus("");
  }

  function addProject() {
    setResume((prev) => ({
      ...prev,
      data: { ...prev.data, projects: [...(prev.data.projects || []), blankProject()] },
    }));
    setStatus("");
  }

  function removeProject(id) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).filter((project) => project.id !== id),
      },
    }));
    setProjectUrlErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function addProjectBullet(projectId) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).map((project) =>
          project.id === projectId
            ? applyProjectPatch(project, {
                bullets: [...(project.bullets || []), { id: createProjectBulletId(), text: "" }],
              })
            : project
        ),
      },
    }));
  }

  function updateProjectBullet(projectId, bulletId, value) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).map((project) =>
          project.id === projectId
            ? applyProjectPatch(project, {
                bullets: (project.bullets || []).map((bullet) =>
                  bullet.id === bulletId ? { ...bullet, text: value } : bullet
                ),
              })
            : project
        ),
      },
    }));
  }

  function removeProjectBullet(projectId, bulletId) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).map((project) =>
          project.id === projectId
            ? applyProjectPatch(project, {
                bullets: (project.bullets || []).filter((bullet) => bullet.id !== bulletId),
              })
            : project
        ),
      },
    }));
  }

  function handleProjectUrlBlur(project) {
    const raw = project.url || project.link || "";
    const checked = normalizeProjectUrl(raw);
    if (!raw.trim()) {
      setProjectUrlErrors((prev) => ({ ...prev, [project.id]: "" }));
      return;
    }
    if (!checked.ok) {
      setProjectUrlErrors((prev) => ({ ...prev, [project.id]: checked.error }));
      return;
    }
    setProjectUrlErrors((prev) => ({ ...prev, [project.id]: "" }));
    updateProject(project.id, { url: checked.href, link: checked.href });
  }

  function techDrafts(project) {
    const list = Array.isArray(project.technologies)
      ? project.technologies.map((item) => String(item ?? ""))
      : [];
    if (list.length) return list;
    const legacy = projectTechnologies(project);
    return legacy.length ? legacy : [""];
  }

  function addProjectTechnology(projectId) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).map((project) =>
          project.id === projectId
            ? applyProjectPatch(project, {
                technologies: [...techDrafts(project), ""],
              })
            : project
        ),
      },
    }));
  }

  function updateProjectTechnology(projectId, index, value) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).map((project) => {
          if (project.id !== projectId) return project;
          const next = [...techDrafts(project)];
          next[index] = value;
          return applyProjectPatch(project, { technologies: next });
        }),
      },
    }));
  }

  function removeProjectTechnology(projectId, index) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        projects: (prev.data.projects || []).map((project) => {
          if (project.id !== projectId) return project;
          const next = techDrafts(project).filter((_, i) => i !== index);
          return applyProjectPatch(project, { technologies: next });
        }),
      },
    }));
  }

  function addCertification() {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        certifications: [...(prev.data.certifications || []), blankCertification()],
      },
    }));
    setStatus("");
  }

  function updateCertification(id, patch) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        certifications: (prev.data.certifications || []).map((cert) =>
          cert.id === id ? { ...cert, ...patch } : cert
        ),
      },
    }));
    setStatus("");
  }

  function removeCertification(id) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        certifications: (prev.data.certifications || []).filter((cert) => cert.id !== id),
      },
    }));
    setCertUrlErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleCertUrlBlur(cert) {
    const raw = cert.url || "";
    const checked = normalizeCertificateUrl(raw);
    if (!raw.trim()) {
      setCertUrlErrors((prev) => ({ ...prev, [cert.id]: "" }));
      return;
    }
    if (!checked.ok) {
      setCertUrlErrors((prev) => ({ ...prev, [cert.id]: checked.error }));
      return;
    }
    setCertUrlErrors((prev) => ({ ...prev, [cert.id]: "" }));
    updateCertification(cert.id, { url: checked.href });
  }

  function addCareerGap() {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        careerGaps: [...(prev.data.careerGaps || []), blankCareerGap()],
      },
    }));
    setStatus("");
  }

  function updateCareerGap(id, patch) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        careerGaps: (prev.data.careerGaps || []).map((gap) =>
          gap.id === id ? applyCareerGapPatch(gap, patch) : gap
        ),
      },
    }));
    setStatus("");
  }

  function removeCareerGap(id) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        careerGaps: (prev.data.careerGaps || []).filter((gap) => gap.id !== id),
      },
    }));
  }

  function updateCareerGapList(id, field, index, value) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        careerGaps: (prev.data.careerGaps || []).map((gap) => {
          if (gap.id !== id) return gap;
          const list = [...(gap[field] || [])];
          list[index] = value;
          return applyCareerGapPatch(gap, { [field]: list });
        }),
      },
    }));
  }

  function addCareerGapListItem(id, field) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        careerGaps: (prev.data.careerGaps || []).map((gap) =>
          gap.id === id ? applyCareerGapPatch(gap, { [field]: [...(gap[field] || []), ""] }) : gap
        ),
      },
    }));
  }

  function removeCareerGapListItem(id, field, index) {
    setResume((prev) => ({
      ...prev,
      data: {
        ...prev.data,
        careerGaps: (prev.data.careerGaps || []).map((gap) => {
          if (gap.id !== id) return gap;
          const list = (gap[field] || []).filter((_, i) => i !== index);
          return applyCareerGapPatch(gap, { [field]: list.length ? list : [""] });
        }),
      },
    }));
  }

  function goToStep(stepId) {
    setNavError("");
    setEditorStep(stepId);
  }

  function goNext() {
    const currentIndex = FORM_STEPS.findIndex((step) => step.id === editorStep);
    if (editorStep === "personal" && !sectionComplete("personal", resume.data)) {
      setNavError("Please enter your name, email, and phone before continuing.");
      return;
    }
    if (editorStep === "projects" && Object.values(projectUrlErrors).some(Boolean)) {
      setNavError("Please enter a valid project URL, or leave the field empty.");
      return;
    }
    if (editorStep === "certifications" && Object.values(certUrlErrors).some(Boolean)) {
      setNavError("Please enter a valid certificate URL, or leave the field empty.");
      return;
    }
    if (editorStep === "career-gap") {
      const incomplete = (resume.data.careerGaps || []).some((gap) => {
        const hasList = (list) => (list || []).some((item) => String(item || "").trim());
        const typeText = String(gap.type || "").trim();
        const hasContent = Boolean(
          (typeText && typeText !== "Other")
          || String(gap.reason || "").trim()
          || String(gap.description || "").trim()
          || String(gap.startMonth || "").trim()
          || String(gap.startYear || "").trim()
          || String(gap.endMonth || "").trim()
          || String(gap.endYear || "").trim()
          || hasList(gap.activities)
          || hasList(gap.skills)
          || hasList(gap.certifications)
          || hasList(gap.projects)
        );
        if (!hasContent) return false;
        const hasStart = String(gap.startMonth || "").trim() && String(gap.startYear || "").trim();
        const hasEnd = gap.current || (String(gap.endMonth || "").trim() && String(gap.endYear || "").trim());
        return !(hasStart && hasEnd);
      });
      if (incomplete) {
        setNavError("Add start and end month/year for each Career Break, or mark it as ongoing.");
        return;
      }
    }
    if (currentIndex >= 0 && currentIndex < FORM_STEPS.length - 1) {
      setNavError("");
      setEditorStep(FORM_STEPS[currentIndex + 1].id);
    }
  }

  function goPrevious() {
    const currentIndex = FORM_STEPS.findIndex((step) => step.id === editorStep);
    if (currentIndex > 0) {
      setNavError("");
      setEditorStep(FORM_STEPS[currentIndex - 1].id);
    }
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
  const sourceData = viewingRewrite && rewriteResult?.rewrittenResume
    ? { ...resume.data, ...rewriteResult.rewrittenResume, photo: resume.data.photo }
    : resume.data;
  const previewData = { ...sourceData };
  delete previewData.targetRole;
  delete previewData.jobDescription;

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
          <nav className="form-stepper" aria-label="Resume sections">
            {FORM_STEPS.map((step) => {
              const done = sectionComplete(step.id, resume.data);
              const active = editorStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={`form-step ${active ? "active" : ""} ${done ? "done" : ""}`}
                  onClick={() => goToStep(step.id)}
                >
                  {done ? "✓ " : ""}{step.label}
                </button>
              );
            })}
          </nav>
          {navError && <p className="alert">{navError}</p>}

          {editorStep === "personal" && (
          <section className="form-section">
            <h2>Personal information</h2>
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
              <label>GitHub / website
                <input value={resume.data.website || ""} onChange={(e) => updateData({ website: e.target.value })} />
              </label>
            </div>
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
            <FormNav onPrevious={goPrevious} onNext={goNext} isFirst />
          </section>
          )}

          {editorStep === "summary" && (
          <section className="form-section">
            <h2>Professional summary</h2>
            <label>Summary
              <textarea
                rows={5}
                value={resume.data.summary || ""}
                onChange={(e) => updateData({ summary: e.target.value })}
              />
            </label>
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "experience" && (
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
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "career-gap" && (
          <section className="form-section">
            <div className="form-section-head">
              <h2>Career Gap / Career Break</h2>
              <button className="btn btn-small" type="button" onClick={addCareerGap}>+ Add</button>
            </div>
            <p className="muted small">Optional. A career break does not reduce your ATS score. Add a start month and year if you include an entry.</p>
            {(resume.data.careerGaps || []).map((gap) => (
              <div className="list-item" key={gap.id}>
                <div className="grid-2">
                  <label>Gap type / reason
                    <select
                      value={
                        CAREER_GAP_TYPES.filter((type) => type !== "Other").includes(gap.type)
                          ? gap.type
                          : (gap.type || gap.reason ? "Other" : "")
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "Other") {
                          const named = CAREER_GAP_TYPES.filter((type) => type !== "Other").includes(gap.type);
                          updateCareerGap(gap.id, named ? { type: "Other", reason: "" } : { type: gap.type || "Other", reason: gap.reason || "" });
                        } else {
                          updateCareerGap(gap.id, { type: value, reason: value });
                        }
                      }}
                    >
                      <option value="">Select (optional)</option>
                      {CAREER_GAP_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </label>
                  <label>Custom reason
                    <input
                      value={gap.type === "Other" ? (gap.reason || "") : (gap.reason || gap.type || "")}
                      onChange={(e) => {
                        const value = e.target.value;
                        const named = CAREER_GAP_TYPES.filter((type) => type !== "Other").includes(gap.type);
                        updateCareerGap(gap.id, {
                          type: named ? gap.type : (value || "Other"),
                          reason: value,
                        });
                      }}
                      placeholder="Career Development Period"
                    />
                  </label>
                  <label>Start month
                    <select value={gap.startMonth || ""} onChange={(e) => updateCareerGap(gap.id, { startMonth: e.target.value })}>
                      <option value="">Month</option>
                      {MONTHS.map((month) => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                  </label>
                  <label>Start year
                    <input value={gap.startYear || ""} onChange={(e) => updateCareerGap(gap.id, { startYear: e.target.value })} placeholder="2024" />
                  </label>
                  <label>End month
                    <select value={gap.endMonth || ""} disabled={gap.current} onChange={(e) => updateCareerGap(gap.id, { endMonth: e.target.value })}>
                      <option value="">Month</option>
                      {MONTHS.map((month) => (
                        <option key={month} value={month}>{month}</option>
                      ))}
                    </select>
                  </label>
                  <label>End year
                    <input value={gap.endYear || ""} disabled={gap.current} onChange={(e) => updateCareerGap(gap.id, { endYear: e.target.value })} placeholder="2025" />
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={Boolean(gap.current)} onChange={(e) => updateCareerGap(gap.id, { current: e.target.checked })} />
                    This break is ongoing
                  </label>
                </div>
                <label>Short description
                  <textarea
                    rows={2}
                    value={gap.description || ""}
                    onChange={(e) => updateCareerGap(gap.id, { description: e.target.value })}
                    placeholder="Continued professional skill development."
                  />
                </label>
                <div className="bullets">
                  <span className="muted small">Activities during the gap</span>
                  {(gap.activities || [""]).map((item, index) => (
                    <div className="bullet-row" key={`${gap.id}-act-${index}`}>
                      <input
                        value={item}
                        onChange={(e) => updateCareerGapList(gap.id, "activities", index, e.target.value)}
                        placeholder="Completed SQL and Power BI certifications."
                      />
                      <button className="btn btn-ghost btn-icon" type="button" onClick={() => removeCareerGapListItem(gap.id, "activities", index)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addCareerGapListItem(gap.id, "activities")}>+ Add activity</button>
                </div>
                <div className="bullets">
                  <span className="muted small">Skills developed</span>
                  {(gap.skills || [""]).map((item, index) => (
                    <div className="bullet-row" key={`${gap.id}-skill-${index}`}>
                      <input
                        value={item}
                        onChange={(e) => updateCareerGapList(gap.id, "skills", index, e.target.value)}
                        placeholder="SQL"
                      />
                      <button className="btn btn-ghost btn-icon" type="button" onClick={() => removeCareerGapListItem(gap.id, "skills", index)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addCareerGapListItem(gap.id, "skills")}>+ Add skill</button>
                </div>
                <div className="bullets">
                  <span className="muted small">Certifications completed</span>
                  {(gap.certifications || [""]).map((item, index) => (
                    <div className="bullet-row" key={`${gap.id}-cert-${index}`}>
                      <input
                        value={item}
                        onChange={(e) => updateCareerGapList(gap.id, "certifications", index, e.target.value)}
                        placeholder="Power BI certification"
                      />
                      <button className="btn btn-ghost btn-icon" type="button" onClick={() => removeCareerGapListItem(gap.id, "certifications", index)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addCareerGapListItem(gap.id, "certifications")}>+ Add certification</button>
                </div>
                <div className="bullets">
                  <span className="muted small">Projects completed</span>
                  {(gap.projects || [""]).map((item, index) => (
                    <div className="bullet-row" key={`${gap.id}-proj-${index}`}>
                      <input
                        value={item}
                        onChange={(e) => updateCareerGapList(gap.id, "projects", index, e.target.value)}
                        placeholder="Sales analytics dashboard"
                      />
                      <button className="btn btn-ghost btn-icon" type="button" onClick={() => removeCareerGapListItem(gap.id, "projects", index)}>✕</button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addCareerGapListItem(gap.id, "projects")}>+ Add project</button>
                </div>
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeCareerGap(gap.id)}>Remove</button>
              </div>
            ))}
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "education" && (
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
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "skills" && (
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
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "projects" && (
          <section className="form-section">
            <div className="form-section-head">
              <h2>Projects</h2>
              <button className="btn btn-small" type="button" onClick={addProject}>+ Add</button>
            </div>
            {(resume.data.projects || []).map((p) => (
              <div className="list-item" key={p.id}>
                <div className="grid-2">
                  <label>Project title
                    <input
                      value={p.name || ""}
                      onChange={(e) => updateProject(p.id, { name: e.target.value })}
                      placeholder="Sales Analytics Dashboard"
                    />
                  </label>
                  <label>Project URL (optional)
                    <input
                      value={p.url || p.link || ""}
                      onChange={(e) => updateProject(p.id, { url: e.target.value, link: e.target.value })}
                      onBlur={() => handleProjectUrlBlur(p)}
                      placeholder="https://github.com/username/project"
                    />
                  </label>
                </div>
                {projectUrlErrors[p.id] && <p className="alert photo-upload-error">{projectUrlErrors[p.id]}</p>}
                <label>Project description
                  <textarea
                    rows={2}
                    value={p.description || ""}
                    onChange={(e) => updateProject(p.id, { description: e.target.value })}
                    placeholder="Developed an interactive dashboard to analyze sales performance and identify business trends."
                  />
                </label>
                <div className="bullets">
                  <span className="muted small">Technologies</span>
                  {techDrafts(p).map((tech, index) => (
                    <div className="bullet-row" key={`${p.id}-tech-${index}`}>
                      <span className="muted small">{index + 1}.</span>
                      <input
                        value={tech}
                        onChange={(e) => updateProjectTechnology(p.id, index, e.target.value)}
                        placeholder="Power BI"
                      />
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={() => removeProjectTechnology(p.id, index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addProjectTechnology(p.id)}>
                    + Add Technology
                  </button>
                </div>
                <div className="bullets">
                  <span className="muted small">Project details / bullet points</span>
                  {(p.bullets || []).map((bullet, index) => (
                    <div className="bullet-row" key={bullet.id}>
                      <span className="muted small">{index + 1}.</span>
                      <input
                        value={bullet.text || ""}
                        onChange={(e) => updateProjectBullet(p.id, bullet.id, e.target.value)}
                        placeholder="Built interactive dashboards using Power BI."
                      />
                      <button
                        className="btn btn-ghost btn-icon"
                        type="button"
                        onClick={() => removeProjectBullet(p.id, bullet.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-small" type="button" onClick={() => addProjectBullet(p.id)}>
                    + Add bullet point
                  </button>
                </div>
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeProject(p.id)}>Remove</button>
              </div>
            ))}
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "certifications" && (
          <section className="form-section">
            <div className="form-section-head">
              <h2>Certifications</h2>
              <button className="btn btn-small" type="button" onClick={addCertification}>+ Add</button>
            </div>
            {(resume.data.certifications || []).map((c) => (
              <div className="list-item" key={c.id}>
                <div className="grid-2">
                  <label>Name
                    <input value={c.name || ""} onChange={(e) => updateCertification(c.id, { name: e.target.value })} />
                  </label>
                  <label>Issuer
                    <input value={c.issuer || ""} onChange={(e) => updateCertification(c.id, { issuer: e.target.value })} />
                  </label>
                  <label>Date
                    <input value={c.date || ""} onChange={(e) => updateCertification(c.id, { date: e.target.value })} />
                  </label>
                  <label>Certificate URL (optional)
                    <input
                      value={c.url || ""}
                      onChange={(e) => updateCertification(c.id, { url: e.target.value })}
                      onBlur={() => handleCertUrlBlur(c)}
                      placeholder="https://example.com/certificate"
                    />
                  </label>
                </div>
                {certUrlErrors[c.id] && <p className="alert photo-upload-error">{certUrlErrors[c.id]}</p>}
                <button className="btn btn-ghost btn-small danger" type="button" onClick={() => removeCertification(c.id)}>Remove</button>
              </div>
            ))}
            <FormNav onPrevious={goPrevious} onNext={goNext} />
          </section>
          )}

          {editorStep === "review" && (
          <section className="form-section">
            <h2>Final review</h2>
            <ul className="review-list">
              {FORM_STEPS.filter((step) => step.id !== "review").map((step) => (
                <li key={step.id}>
                  {sectionComplete(step.id, resume.data) ? "✓" : "○"} {step.label}
                </li>
              ))}
            </ul>
            <p className="muted small">Save and Export / Print PDF remain in the toolbar. All section data stays in this resume until you save.</p>
            <FormNav onPrevious={goPrevious} onNext={goNext} isLast />
          </section>
          )}

          {editorStep === "review" && (
          <AtsAnalysisPanel
            targetRole={resume.data.targetRole || ""}
            jobDescription={resume.data.jobDescription || ""}
            onTargetRole={(value) => updateData({ targetRole: value })}
            onJobDescription={(value) => updateData({ jobDescription: value })}
            onAnalyze={handleAnalyze}
            analyzing={analyzing}
            analysis={analysis}
            error={analyzeError}
            stale={Boolean(analysis && analyzedFingerprint && analyzedFingerprint !== analysisFingerprint(resume))}
            previousScore={previousScore}
            onRewrite={handleRewrite}
            rewriting={rewriting}
            rewriteError={rewriteError}
            rewriteResult={rewriteResult}
            viewingRewrite={viewingRewrite}
            onViewRewrite={() => setViewingRewrite(true)}
            onApplyRewrite={handleApplyRewrite}
            onCancelRewrite={() => {
              setRewriteResult(null);
              setViewingRewrite(false);
              setRewriteError("");
            }}
            onUndoRewrite={handleUndoRewrite}
            canUndo={Boolean(undoSnapshot)}
          />
          )}
        </div>

        <div className="editor-preview" ref={previewPaneRef}>
          <div
            className="preview-stack"
            style={{ width: Math.round(RESUME_PAGE.width * previewScale) }}
          >
          {viewingRewrite && (
            <p className="ats-stale no-print preview-rewrite-note">
              Previewing rewritten resume — the original is unchanged until you apply the rewrite.
            </p>
          )}
          {overfull && (
            <p className="alert no-print page-fit-warning">
              Your resume contains a large amount of content. Consider shortening some sections to maintain one-page readability.
            </p>
          )}
          <div
            className="preview-scale-frame"
            style={{
              width: Math.round(RESUME_PAGE.width * previewScale),
              height: Math.round(RESUME_PAGE.height * previewScale),
            }}
          >
            <div
              className="preview-sheet"
              id="print-area"
              ref={sheetRef}
              data-density="normal"
              style={{ transform: `scale(${previewScale})` }}
            >
              <TemplateComponent data={previewData} />
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormNav({ onPrevious, onNext, isFirst, isLast }) {
  return (
    <div className="form-nav">
      <button type="button" className="btn" onClick={onPrevious} disabled={isFirst}>
        Previous
      </button>
      {!isLast && (
        <button type="button" className="btn btn-primary" onClick={onNext}>
          Next
        </button>
      )}
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
