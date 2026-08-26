const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { analyzeResume } = require("../services/resumeAnalyzer");
const { rewriteResume } = require("../services/resumeRewriter");
const { recommendRoles } = require("../services/careerGuidance");

const router = express.Router();

const LEGACY_TEMPLATE_IDS = {
  "modern-sidebar": "ats-modern",
  "creative-bold": "ats-professional",
};

const TEMPLATES = [
  {
    id: "photo-professional",
    name: "Photo Professional",
    category: "with-photo",
    hasPhoto: true,
    atsFriendly: true,
    description: "Professional single-column resume with a clean optional photo header.",
  },
  {
    id: "photo-executive",
    name: "Photo Executive",
    category: "with-photo",
    hasPhoto: true,
    atsFriendly: true,
    description: "Spacious executive layout with a small circular profile photo.",
  },
  {
    id: "photo-modern",
    name: "Photo Modern",
    category: "with-photo",
    hasPhoto: true,
    atsFriendly: true,
    description: "Modern ATS-safe resume with a subtle accent line and optional photo.",
  },
  {
    id: "photo-corporate",
    name: "Photo Corporate",
    category: "with-photo",
    hasPhoto: true,
    atsFriendly: true,
    description: "Formal corporate resume for business, finance, IT, and management roles.",
  },
  {
    id: "photo-elegant",
    name: "Photo Elegant",
    category: "with-photo",
    hasPhoto: true,
    atsFriendly: true,
    description: "Elegant serif headings with a small professional photo.",
  },
  {
    id: "ats-classic",
    name: "ATS Classic",
    category: "without-photo",
    hasPhoto: false,
    atsFriendly: true,
    description: "Traditional chronological resume with a centered header and clear rules.",
  },
  {
    id: "ats-professional",
    name: "ATS Professional",
    category: "without-photo",
    hasPhoto: false,
    atsFriendly: true,
    description: "Modern corporate layout with left-aligned header and strong hierarchy.",
  },
  {
    id: "ats-executive",
    name: "ATS Executive",
    category: "without-photo",
    hasPhoto: false,
    atsFriendly: true,
    description: "Senior-level resume with a prominent name, summary, and achievements.",
  },
  {
    id: "ats-minimal",
    name: "ATS Minimal",
    category: "without-photo",
    hasPhoto: false,
    atsFriendly: true,
    description: "Extremely clean single-column resume with generous white space.",
  },
  {
    id: "ats-modern",
    name: "ATS Modern",
    category: "without-photo",
    hasPhoto: false,
    atsFriendly: true,
    description: "Compact modern professional resume for technology and business roles.",
  },
];

function resolveTemplateId(id) {
  const mapped = LEGACY_TEMPLATE_IDS[id] || id;
  return TEMPLATES.some((t) => t.id === mapped) ? mapped : "ats-minimal";
}

router.get("/templates", (req, res) => {
  res.json(TEMPLATES);
});

router.use(requireAuth);

// POST /api/resumes/analyze — role-based estimated ATS compatibility.
// Must be registered before /:id so "analyze" is never treated as an id.
router.post("/analyze", (req, res) => {
  try {
    const body = req.body || {};
    const targetRole = String(body.targetRole || "").trim();
    if (!targetRole) {
      return res.status(400).json({ error: "Enter a target job role to analyze your resume." });
    }

    const resume = body.resume && typeof body.resume === "object" ? body.resume : {};
    const jobDescription = String(body.jobDescription || "").slice(0, 50000);
    const templateId = body.templateId || resume.templateId;

    const result = analyzeResume({
      resume,
      targetRole,
      jobDescription,
      templateId,
    });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("Resume analysis failed:", err);
    res.status(status).json({ error: err.message || "Analysis failed. Please try again." });
  }
});

function handleCareerGuidanceRequest(req, res, resumeIdRaw) {
  try {
    const resumeId = Number(resumeIdRaw);
    if (!Number.isFinite(resumeId)) {
      return res.status(404).json({ error: "Resume not found." });
    }
    const stored = db.getResume(resumeId, req.userId);
    if (!stored) return res.status(404).json({ error: "Resume not found." });
    const result = recommendRoles({ resume: stored.data || {} });
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("Career guidance failed:", err);
    res.status(status).json({ error: err.message || "Could not recommend roles. Please try again." });
  }
}

// Must be registered before /:id so "career-guidance" is never treated as an id.
router.post("/career-guidance", (req, res) => {
  const body = req.body || {};
  handleCareerGuidanceRequest(req, res, body.resumeId);
});

function handleRewriteRequest(req, res, storedResume) {
  try {
    const body = req.body || {};
    const fallbackRole = storedResume && storedResume.data ? storedResume.data.targetRole : "";
    const targetRole = String(body.targetRole || fallbackRole || "").trim();
    if (!targetRole) {
      return res.status(400).json({ error: "Enter a target job role before rewriting your resume." });
    }

    const editorResume = body.resume && typeof body.resume === "object"
      ? body.resume
      : (storedResume && storedResume.data) || {};
    const result = rewriteResume({
      resume: editorResume,
      targetRole,
      jobDescription: String(body.jobDescription || editorResume.jobDescription || "").slice(0, 50000),
      analysis: body.analysis && typeof body.analysis === "object" ? body.analysis : null,
      templateId: body.templateId || (storedResume && storedResume.templateId) || editorResume.templateId,
    });
    res.json({
      success: true,
      ...result,
      beforeScore: result.estimatedScoreBefore,
      afterScore: result.estimatedScoreAfter,
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("Resume rewrite failed:", err);
    res.status(status).json({ error: err.message || "Rewrite failed. Please try again." });
  }
}

// POST /api/resumes/rewrite — editor sends current unsaved resume data
router.post("/rewrite", (req, res) => {
  handleRewriteRequest(req, res, null);
});

// POST /api/resumes/:id/rewrite — verifies the resume belongs to the signed-in user
router.post("/:id/rewrite", (req, res) => {
  const stored = db.getResume(Number(req.params.id), req.userId);
  if (!stored) return res.status(404).json({ error: "Resume not found." });
  handleRewriteRequest(req, res, stored);
});

router.post("/:id/career-guidance", (req, res) => {
  handleCareerGuidanceRequest(req, res, req.params.id);
});

function publicResume(r) {
  return {
    id: r.id,
    title: r.title,
    templateId: resolveTemplateId(r.templateId),
    data: r.data,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// GET /api/resumes - list current user's resumes
router.get("/", (req, res) => {
  const resumes = db.listResumesByUser(req.userId);
  res.json(resumes.map(publicResume));
});

// GET /api/resumes/:id
router.get("/:id", (req, res) => {
  const resume = db.getResume(Number(req.params.id), req.userId);
  if (!resume) return res.status(404).json({ error: "Resume not found." });
  res.json(publicResume(resume));
});

// POST /api/resumes - create a new resume
router.post("/", (req, res) => {
  const { title, templateId, data } = req.body || {};
  const finalTemplateId = resolveTemplateId(templateId);

  const resume = db.createResume({
    userId: req.userId,
    title: title || "Untitled resume",
    templateId: finalTemplateId,
    data: data || {},
  });

  res.status(201).json(publicResume(resume));
});

// PUT /api/resumes/:id - update title / templateId / data
// This is also what powers "switch template" -> the same structured data
// gets saved with a new templateId, and the frontend re-renders it into
// that template's layout instantly.
router.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.getResume(id, req.userId);
  if (!existing) return res.status(404).json({ error: "Resume not found." });

  const { title, templateId, data } = req.body || {};
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (data !== undefined) patch.data = data;
  if (templateId !== undefined) {
    patch.templateId = resolveTemplateId(templateId);
  }

  const updated = db.updateResume(id, req.userId, patch);
  res.json(publicResume(updated));
});

// DELETE /api/resumes/:id
router.delete("/:id", (req, res) => {
  const deleted = db.deleteResume(Number(req.params.id), req.userId);
  if (!deleted) return res.status(404).json({ error: "Resume not found." });
  res.status(204).send();
});

module.exports = router;
