# Resume extraction pipeline map

## Proven from DB resumes (not hardcoded)

### IT-Resume (2).pdf
- Stored city was polluted / later manually corrected (LinkedIn/GitHub in city string).
- Summary largely AI-suggested (user confirmed).
- Raw text: single-column OK; summary prose mis-inferred as education; job title glued to dates.

### Keerthi_CV.pdf
- Stored: 1 merged experience; languages = address fragments; city manually set.
- Raw text: PDF reading-order corruption — prose jobs/education appear before section headings.
- `Worked as … at … from … to …` / `till date` patterns; `Languages known:` + address leakage.

## Pipeline

upload-file → ResumeProcessor → ResumeExtractor (**Google Document AI only**)

→ parseResumeTextWithOptionalAi (heuristic + optional Gemini + grounded merge)
→ contentJson → wizard → ATS

Local Tesseract OCR (`tesseract.js` / `eng.traineddata`) was removed; scanned PDFs and images use Document AI when configured.

Weak alternate path: web `candidates/resume/parse` + `parse-resume.ts` (not used by main upload wizard).

## Fixes landed (generic) — plan A–H
- **A** Bullet reflow (`bullet-reflow.ts`) before entity parse
- **B** Document-wide PII sweep (`pii-sweep.ts`) → personal/address; strip from skills/languages
- **C** Employer boundary detector (`employer-boundary.ts`) — pure heuristic/regex, no LLM
- **D** Extended prose date-line joins; normalize only (no invented day/month)
- **E** Near-dupe collapse same employer only (`section-rescue.ts`)
- **F** Late-heading body rescue + existing tab column reorder — pure heuristic, no LLM
- **G** Post-extract validators (`extract-validate.ts`) → `fieldConfidence` flags
- **H** Regression fixtures in `parse-extracted-resume.unit.test.ts`

### Accuracy tradeoff (C + F = heuristic-only)
Works well on heading/prose patterns similar to the Keerthi / IT samples. Unusual layouts (dense tables, image-only sections, multi-column without tabs, non-English employer cues) may still mis-split employers or leave pre-heading body in the wrong bucket. Prefer empty/flagged fields over invention.

### Optional (not required for A–H)
Lightweight LLM boundary fallback only when validators report high ambiguity — reuse existing Gemini `structureResumeText` + grounded merge (already in path). No new prompt/service unless enabled later.

## Contamination / download notes (2026-09)

Portal download regenerates from `contentJson` (CareerBridge template). If another
candidate's fields appear in a download, the **Resume row was already wrong**.

Likely write paths (not LLM chat reuse):
1. **GCS key collision** — was `filename + id.slice(0,8)`; now uses **full resumeId**.
2. **Wizard autofill sessionStorage** surviving logout — cleared on `clearSession()`.
3. Public worker reprocess from GCS amplifies (1).

Safety: `applyContentGroundingGate` before DB write; download prefers original upload.
