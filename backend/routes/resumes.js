const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

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
