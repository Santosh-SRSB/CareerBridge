# Resume Builder ATS Integration Guide

This document explains everything added in the `features/atschecker` work so the same functionality can be integrated into an already-built resume system.

**Do not rebuild the host application.** Copy the ATS engine, data-normalization helpers, APIs, and UI pieces into the existing product. Keep existing login, templates, save, and PDF/print flows unless a small hook is required.

Branch: `features/atschecker`  
Repo: `https://github.com/Santosh-SRSB/CareerBridge.git`

---

## Latest update — Career Gap / Career Break

This branch now includes an **optional Career Gap / Career Break** section. Existing ATS scoring, rewrite, templates, save, and PDF/print behavior are unchanged except for the additions below.

What was added:

- Optional editor step after Experience: gap type/reason, start/end month and year, description, activities, skills, certifications, and projects
- A **Career Break** block on the printed resume (same month-year date style as the rest of the resume)
- ATS **Career Timeline** report: employment gaps detected, longest gap, explanation status, date consistency
- Skills/keywords from gap activities are included in ATS analysis
- Rewrite keeps Career Break entries; it may polish wording only and never invents a reason

What was **not** changed:

- ATS weights in `atsWeights.js`
- Overall score formula
- 5-star rating formula

Important ATS rule:

- A career gap is a timeline condition, **not** an ATS failure
- `atsPenalty` is always `0`
- An unexplained hole between jobs is a **recommendation only**, never an automatic score cut
- The system never invents gap reasons, jobs, freelance work, certifications, projects, or skills

---

## 1. What was added

This work adds the following on top of the existing Resume Builder:

| Feature | Behavior |
|---|---|
| Role-based ATS analysis | Estimated compatibility score for a target job role |
| Job-description override | If a JD is pasted, it overrides generic role skill assumptions |
| Skills / experience / project / certification / education matrices | Section-level evidence used by the score |
| 5-star rating | Derived from overall score |
| Resume rewrite | Deterministic, no LLM. Rewrites wording from facts already in the resume |
| Multi-step editor | Personal → Summary → Education → Experience → Career Gap → Skills → Projects → Certifications → Review & ATS |
| Multiple project technologies | `technologies: ["SQL", "Power BI", ...]` |
| Optional project URL | Saved and shown only when present |
| Optional certificate URL | Validated if provided; omitted from the resume when empty |
| Optional Career Gap / Career Break | Timeline entry with activities, skills, certs, and projects. **Never reduces ATS score or star rating** |
| One-page A4 preview | Live preview scales to the editor pane; print/PDF stays full A4 |
| Original typography | Resume body stays 13.5px. Fitting reduces spacing, not font size |

Existing features that must stay working:

- Authentication
- Resume templates (10 ATS-friendly layouts)
- Save / load
- Export / Print PDF
- Education, experience, skills, summary
- Photo templates

---

## 2. Architecture

```
Frontend (Vite / React, port 5173)
  Editor.jsx
    → api.analyzeResume()     POST /api/resumes/analyze
    → api.rewriteResume(id)   POST /api/resumes/:id/rewrite
    → api.updateResume(id)    PUT  /api/resumes/:id
    → window.print()          PDF export (unchanged)

Backend (Express, port 4000)
  routes/resumes.js
    → services/resumeAnalyzer.js
    → services/resumeRewriter.js
    → services/careerGapUtils.js
    → services/atsWeights.js
    → services/roleKnowledge.js
    → services/projectUtils.js
    → services/templateProfiles.js
```

Storage in this prototype is a JSON file (`backend/resume_builder.db.json`). Resume content lives in a single JSON blob: `resume.data`.

**If the host system already uses PostgreSQL / Prisma / Mongo:** do not create new tables. Add the new fields inside the existing resume JSON document / `data` column.

---

## 3. Files to copy

### Backend (copy as-is)

| File | Purpose |
|---|---|
| `backend/services/atsWeights.js` | Overall score weights. **Do not change.** |
| `backend/services/roleKnowledge.js` | Role titles, required/preferred skills, keywords |
| `backend/services/templateProfiles.js` | Template ATS formatting hints |
| `backend/services/careerGapUtils.js` | Career break parsing and timeline analysis (no score penalty) |
| `backend/services/resumeAnalyzer.js` | Scoring engine |
| `backend/services/resumeRewriter.js` | Deterministic rewrite engine |
| `backend/scripts/testAnalyzer.js` | Analyzer regression tests |
| `backend/scripts/testRewriter.js` | Rewrite + multi-tech tests |

### Backend (merge into existing files)

| File | What to merge |
|---|---|
| `backend/routes/resumes.js` | `POST /analyze`, `POST /rewrite`, `POST /:id/rewrite` |
| `backend/package.json` | scripts `test:analyzer` and `test:rewrite` |
| `backend/.env.example` | optional `AI_API_KEY` / `AI_MODEL` placeholders (unused by the current engine) |

### Frontend (copy as-is)

| File | Purpose |
|---|---|
| `frontend/src/components/AtsAnalysisPanel.jsx` | Score, matrices, rewrite preview/apply/undo |
| `frontend/src/templates/pageFit.js` | A4 density + live-preview scale |
| `frontend/scripts/testPageFit.js` | Density-picker unit checks |

### Frontend (merge into existing files)

| File | What to merge |
|---|---|
| `frontend/src/api.js` | `analyzeResume`, `rewriteResume` |
| `frontend/src/pages/Editor.jsx` | Stepper, project techs, URLs, optional Career Gap, ATS panel, preview scale |
| `frontend/src/pages/Dashboard.jsx` | Tiny related copy if present |
| `frontend/src/templates/helpers.js` | Project/cert/career-gap normalization, URL validators |
| `frontend/src/templates/sections.jsx` | Project techs + URLs, compact cert list, Career Break section |
| `frontend/src/templates/TemplatePreview.jsx` | Shared A4 page constants |
| `frontend/src/styles.css` | ATS panel, stepper, A4 sheet, preview scale |

Do **not** replace the host app's login, router, or database layer.

---

## 4. Critical route order

Register static paths **before** `/:id`, otherwise `analyze` and `rewrite` are treated as resume IDs and return `404 { "error": "Not found." }`.

```js
router.post("/analyze", ...);
router.post("/rewrite", ...);
router.post("/:id/rewrite", ...);
router.get("/:id", ...);
router.put("/:id", ...);
```

Both rewrite endpoints are JWT-protected.  
`POST /:id/rewrite` also checks that the resume belongs to the signed-in user.

After adding routes, **restart the backend**. A process started before the new routes existed will keep returning 404 for rewrite.

---

## 5. API contracts

All ATS endpoints require `Authorization: Bearer <jwt>` except template listing.

### 5.1 Analyze

`POST /api/resumes/analyze`

```json
{
  "targetRole": "Data Analyst",
  "jobDescription": "Optional JD text...",
  "templateId": "ats-minimal",
  "resume": {
    "fullName": "Priya Sharma",
    "title": "Data Analyst",
    "summary": "...",
    "skills": ["SQL", "Python", "Power BI"],
    "experience": [],
    "projects": [],
    "education": [],
    "certifications": [],
    "careerGaps": []
  }
}
```

`targetRole` is required. Empty role → `400`.

Important response fields:

```json
{
  "overallScore": 81,
  "starRating": 4.5,
  "interpretation": "Strong Match",
  "roleMatch": 81,
  "skillsMatch": 93,
  "experienceScore": 70,
  "projectsScore": 65,
  "certificationsScore": 80,
  "educationScore": 75,
  "keywordMatch": 70,
  "atsFormatting": 85,
  "contentQuality": 70,
  "missingSkills": [],
  "missingKeywords": [],
  "skillsMatrix": { "rows": [] },
  "projectMatrix": [],
  "experienceMatrix": {},
  "certificationMatrix": [],
  "educationAnalysis": {},
  "careerTimeline": {
    "employmentGapsDetected": 1,
    "longestGap": "9 months",
    "gapExplanation": "Provided",
    "dateConsistency": "Good",
    "atsImpact": "No direct penalty",
    "atsPenalty": 0,
    "recommendation": "Career gap is clearly represented. No action required."
  },
  "weights": {
    "roleMatch": 35,
    "skills": 20,
    "experience": 15,
    "projects": 10,
    "certifications": 5,
    "education": 5,
    "formatting": 5,
    "contentQuality": 5
  },
  "disclaimer": "This score estimates how well your resume matches..."
}
```

This is an **estimated** ATS score. Never claim “this resume will pass ATS”.

### 5.2 Rewrite

Preferred (used by this editor):

`POST /api/resumes/:id/rewrite`

Also available for unsaved editor state:

`POST /api/resumes/rewrite`

Request body (same shape as analyze, plus optional previous analysis):

```json
{
  "targetRole": "Data Analyst",
  "jobDescription": "...",
  "templateId": "ats-minimal",
  "resume": { },
  "analysis": null
}
```

Response includes:

```json
{
  "success": true,
  "rewrittenResume": { },
  "changes": ["Summary customized for Data Analyst"],
  "estimatedScoreBefore": 64,
  "estimatedScoreAfter": 69,
  "beforeScore": 64,
  "afterScore": 69,
  "engine": "deterministic-role-rewrite",
  "integrityNote": "Wording and skill order were improved using only facts already present..."
}
```

Rewrite **does not persist**. The editor shows a preview. Apply uses the existing `PUT /api/resumes/:id`. Undo restores the in-memory snapshot from before Apply.

### 5.3 Save (unchanged endpoint)

`PUT /api/resumes/:id`

Send the full `data` object, including new project/cert fields. No schema migration is required when `data` is JSON.

---

## 6. Resume data shape

`resume.data` is the source of truth. Normalize on load and on save.

### 6.1 Top-level fields used by ATS

```js
{
  fullName, title, email, phone, location, linkedin, website, photo,
  summary,
  skills: ["SQL", "Python"],
  experience: [...],
  education: [...],
  projects: [...],
  certifications: [...],
  targetRole: "Data Analyst",      // persisted on the resume JSON
  jobDescription: ""               // persisted on the resume JSON
}
```

`targetRole` and `jobDescription` are stored on `data` so Analyze/Rewrite remember the last role. They are **stripped from the printed resume preview**.

### 6.2 Project (canonical)

```js
{
  id: "project-...",
  name: "Sales Analytics Dashboard",
  title: "Sales Analytics Dashboard",   // kept in sync with name
  description: "Paragraph description...",
  bullets: [{ id: "project-bullet-...", text: "Built interactive dashboards." }],
  bulletPoints: ["Built interactive dashboards."],
  technologies: ["Power BI", "SQL", "Excel", "Python"],
  url: "https://github.com/example/project",
  link: "https://github.com/example/project",  // kept in sync with url
  startDate: "",
  endDate: ""
}
```

Helpers:

- Frontend: `normalizeProjectList()`, `projectTechnologies()`, `normalizeProjectUrl()` in `frontend/src/templates/helpers.js`
- Backend: same logic in `backend/services/projectUtils.js`

### 6.3 Project backward compatibility

| Old data | How it is read |
|---|---|
| `technology: "Power BI"` | becomes `["Power BI"]` |
| `tech: "React"` | becomes `["React"]` |
| `technologies: "SQL, Excel"` | split on commas |
| `link` without `url` | treated as URL |
| missing URL | `url: ""` — allowed |

Empty technology strings are dropped on save and are never printed.

### 6.4 Certification (canonical)

```js
{
  id: "certification-...",
  name: "Python Programming Certificate",
  issuer: "ABC Institute",
  date: "2025",
  url: "https://example.com/certificate"   // optional
}
```

Missing `url` / `link` still loads. Invalid URLs show:

`Please enter a valid certificate URL.`

Empty URL is valid and is not shown on the resume.

### 6.5 Career Gap / Career Break (optional)

```js
{
  id: "career-gap-...",
  type: "Career Development Period",
  reason: "Career Development Period",
  startMonth: "June",
  startYear: "2024",
  endMonth: "March",
  endYear: "2025",
  current: false,
  description: "Continued professional skill development.",
  activities: ["Completed SQL and Power BI certifications."],
  skills: ["SQL", "Power BI"],
  certifications: ["SQL Certification"],
  projects: ["Practice analytics dashboard"],
  startDate: "June 2024",
  endDate: "March 2025"
}
```

Missing `careerGaps` still loads. Dates are required only if the user creates an entry. A career break **must not** reduce the ATS score. Analyze skills/keywords from gap activities; never invent a reason.

Timeline report field: `careerTimeline` (`atsImpact: "No direct penalty"`, `atsPenalty: 0`).

---

## 7. ATS scoring (do not change)

Weights live only in `backend/services/atsWeights.js` and **must sum to 100**:

| Part | Weight |
|---|---|
| Role match | 35 |
| Skills | 20 |
| Experience | 15 |
| Projects | 10 |
| Certifications | 5 |
| Education | 5 |
| Formatting | 5 |
| Content quality | 5 |

Rules the integrator must keep:

1. Do not move weights into the frontend.
2. Do not invent skills, employers, metrics, or certifications during rewrite.
3. Job description, when present, overrides generic role skill lists.
4. Missing project/certificate URLs are optional. They are a small positive signal when present; they must not heavily penalize the score.
5. **All** project technologies are included in skill/project/keyword evidence — not only the first one.
7. A career gap is a timeline condition, not an ATS failure. `atsPenalty` is always `0`.
8. The UI must keep the disclaimer: this is an estimated match, not a guarantee.

Star rating is derived from `overallScore` inside `resumeAnalyzer.js`.

---

## 8. Rewrite guarantees

The rewrite engine is **deterministic** (`engine: "deterministic-role-rewrite"`). It does not call an LLM even if `AI_API_KEY` is set.

It may:

- Reorder existing skills toward the target role
- Polish summary / bullets using words already in the resume
- Keep project technologies, project URL, cert URL, dates, company names

It must not:

- Invent Spring Boot, metrics, employers, degrees, or certificates
- Remove unrelated skills that the user actually listed
- Drop project bullets, technologies, or URLs
- Change contact details or the profile photo

When integrating, after Apply, merge:

```js
{
  ...rewrittenResume,
  photo: original.photo,
  targetRole: original.targetRole,
  jobDescription: original.jobDescription
}
```

---

## 9. Editor UX to preserve

### Section order

1. Personal (name, email, phone required before Next)
2. Summary
3. Education
4. Experience
5. Skills
6. Projects
7. Certifications
8. Review & ATS

Navigation is **Next / Previous**, plus clickable step chips. It does **not** auto-advance on keystroke. All section data stays in `resume.data`.

### Projects UI

- One input per technology
- `+ Add Technology` / `Remove`
- Project URL (optional)
- Paragraph description + bullet points

### Preview

- Paper size is A4 at 96dpi: **794 × 1123 px**
- The editor pane **scales** the sheet to the column width (`usePreviewScale`)
- Print/PDF resets that scale (`transform: none`) so export matches a full A4 page
- Typography stays 13.5px; crowding only tightens spacing (`normal` → `compact` → `tight` → `min`)
- If content still cannot fit at minimum spacing, show:

  *Your resume contains a large amount of content. Consider shortening some sections to maintain one-page readability.*

Do not hide overflow with `overflow: hidden` unless the content already fits.

---

## 10. How to integrate into an existing system

Use this sequence.

### Step A — Backend scoring engine

1. Copy the six `backend/services/*` files listed above.
2. Add analyze + rewrite routes **before** `/:id`.
3. Keep the host auth middleware (`requireAuth` / JWT).
4. Restart the API process.
5. Run:

```bash
cd backend
npm run test:analyzer
npm run test:rewrite
```

Expected: both scripts print that all checks passed. Data Analyst scores higher than Java Developer on a data-analyst resume.

### Step B — Resume JSON

1. Keep storing the resume as one JSON object.
2. On load, run `normalizeProjectList` and `normalizeCertificationList` (or the backend equivalents).
3. On save, run the same normalizers so empty techs and invalid empty strings are cleaned.
4. Do not migrate old rows destructively. `technology: "React"` must still display as `["React"]`.

### Step C — Frontend

1. Copy `AtsAnalysisPanel.jsx` and `pageFit.js`.
2. Wire Analyze / Rewrite buttons to the new APIs.
3. Persist `targetRole` and `jobDescription` on `resume.data`.
4. Strip those two fields before rendering templates.
5. Reuse existing Save and Print buttons.

### Step D — Host-system mapping

If the host app uses different field names, map at the API boundary:

| Host field | This engine |
|---|---|
| `jobTitle` / `headline` | `title` |
| `about` / `bio` | `summary` |
| `workHistory` | `experience[]` with `role`, `company`, `bullets[]` |
| `tools` on a project | `technologies[]` |
| `repoUrl` | `url` / `link` |
| `certificateLink` | `certifications[].url` |

Do the mapping in one adapter. Do not fork `resumeAnalyzer.js`.

---

## 11. Tests to run after integration

```bash
# backend
npm run test:analyzer
npm run test:rewrite

# frontend helper / density checks
node frontend/scripts/testPageFit.js
```

Manual checks:

- [ ] Analyze with role only
- [ ] Analyze with job description (JD should change missing-skill list)
- [ ] Same resume, Data Analyst vs Java Developer → different scores
- [ ] Rewrite preview / apply / cancel / undo
- [ ] Rewrite keeps multiple technologies and URLs
- [ ] Save, reload, fields still present
- [ ] Project without URL saves
- [ ] Invalid certificate URL shows the validation message
- [ ] Print/PDF still works
- [ ] Login still works
- [ ] Old resumes without `technologies[]` / `url` still open

---

## 12. What not to change

- `ATS_WEIGHTS`
- Template visual design (colors, fonts, photo placement)
- Auth / JWT
- Database tables (extend JSON only)
- PDF library (this app uses `window.print()`)
- Existing CRUD paths except adding analyze/rewrite beside them

---

## 13. Known limits

- Scores are estimates. Different employer ATS software will differ.
- Rewrite is rule-based, not an LLM. It will not invent missing experience.
- Extremely long resumes may still overflow A4 after spacing compression; the warning is shown instead of deleting content.
- If rewrite 404s with `{ "error": "Not found." }`, the running Node process does not have the new routes. Restart the backend.

---

## 14. Quick file map for reviewers

```
backend/services/atsWeights.js          scoring weights
backend/services/roleKnowledge.js       role skill libraries
backend/services/resumeAnalyzer.js      ATS engine
backend/services/resumeRewriter.js      rewrite engine
backend/services/projectUtils.js        project field readers
backend/routes/resumes.js               /analyze and /rewrite
frontend/src/components/AtsAnalysisPanel.jsx
frontend/src/pages/Editor.jsx            wizard + preview
frontend/src/templates/helpers.js        normalize projects/certs
frontend/src/templates/sections.jsx      resume rendering
frontend/src/templates/pageFit.js        A4 fit + pane scale
```

When in doubt: **analyze and rewrite are pure functions of `resume` JSON + `targetRole` + optional `jobDescription`.** If those three inputs are mapped correctly, the rest of the host app can stay as it is.
