import React from "react";

function StarRating({ value }) {
  const rating = Number(value) || 0;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const glyphs = `${"★".repeat(full)}${half ? "½" : ""}`;
  return (
    <span className="ats-stars" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      <span className="ats-star-glyphs" aria-hidden="true">{glyphs || "☆"}</span>
      <span className="ats-star-value">{rating.toFixed(1)} / 5</span>
    </span>
  );
}

function ScoreRing({ score, label }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0));
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="ats-ring" role="img" aria-label={`${label || "ATS score"} ${value} out of 100`}>
      <svg viewBox="0 0 100 100" className="ats-ring-svg" aria-hidden="true">
        <circle className="ats-ring-track" cx="50" cy="50" r={radius} />
        <circle
          className="ats-ring-value"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ats-ring-label">
        <strong>{value}</strong>
        <span> / 100</span>
      </div>
    </div>
  );
}

function Bar({ value }) {
  const n = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="ats-bar" aria-hidden="true">
      <span style={{ width: `${n}%` }} />
    </div>
  );
}

function EvidenceTag({ level }) {
  if (!level) return null;
  return <span className={`ats-evidence ats-evidence-${String(level).toLowerCase().replace(/\s+/g, "-")}`}>{level}</span>;
}

export default function AtsAnalysisPanel({
  targetRole,
  jobDescription,
  onTargetRole,
  onJobDescription,
  onAnalyze,
  analyzing,
  analysis,
  error,
  stale,
  previousScore,
  onRewrite,
  rewriting,
  rewriteError,
  rewriteResult,
  viewingRewrite,
  onViewRewrite,
  onApplyRewrite,
  onCancelRewrite,
  onUndoRewrite,
  canUndo,
}) {
  const improvement =
    analysis && previousScore != null && previousScore !== analysis.overallScore
      ? analysis.overallScore - previousScore
      : null;

  return (
    <section className="form-section ats-panel" aria-labelledby="ats-heading">
      <h2 id="ats-heading">Resume ATS analysis</h2>
      <p className="muted small ats-disclaimer-intro">
        Estimated ATS compatibility — not a guarantee that an employer&apos;s system will pass or reject your resume.
      </p>

      <label>
        Target job role
        <input
          value={targetRole}
          onChange={(e) => onTargetRole(e.target.value)}
          placeholder="Data Analyst"
          autoComplete="off"
        />
      </label>
      <label>
        Optional job description
        <textarea
          rows={6}
          value={jobDescription}
          onChange={(e) => onJobDescription(e.target.value)}
          placeholder="Paste the job description here…"
        />
      </label>
      <div className="ats-actions">
        <button className="btn btn-primary" type="button" onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze resume"}
        </button>
      </div>

      {error && <p className="alert ats-error">{error}</p>}
      {stale && analysis && (
        <p className="ats-stale" role="status">
          Resume changed — re-analyze to update your score.
        </p>
      )}

      {analysis && (
        <div className="ats-results">
          <div className="ats-hero">
            <ScoreRing score={analysis.overallScore} label="Estimated ATS compatibility" />
            <div className="ats-hero-copy">
              <p className="ats-kicker">Estimated ATS compatibility</p>
              <p className="ats-score-text">
                <strong>{analysis.overallScore}</strong>
                <span> / 100</span>
              </p>
              <StarRating value={analysis.starRating} />
              <p className={`ats-band ats-band-${analysis.interpretationBand}`}>{analysis.interpretation}</p>
              <p className="muted small">{analysis.interpretationDetail}</p>
            </div>
          </div>

          {improvement != null && (
            <div className="ats-improvement" role="status">
              <span className="ats-kicker">ATS score improvement</span>
              <strong>
                {previousScore} → {analysis.overallScore}
              </strong>
              <span className={improvement > 0 ? "ats-delta-up" : improvement < 0 ? "ats-delta-down" : ""}>
                {improvement > 0 ? "+" : ""}
                {improvement} {Math.abs(improvement) === 1 ? "point" : "points"}
              </span>
            </div>
          )}

          <p className="muted small ats-disclaimer">{analysis.disclaimer}</p>

          <h3>Score breakdown</h3>
          <ul className="ats-breakdown">
            {[
              ["Role match", analysis.roleMatch],
              ["Skills match", analysis.skillsMatch],
              ["Experience", analysis.experienceScore],
              ["Projects", analysis.projectsScore],
              ["Certifications", analysis.certificationsScore],
              ["Education", analysis.educationScore],
              ["Keywords", analysis.keywordMatch],
              ["ATS formatting", analysis.atsFormatting],
              ["Content quality", analysis.contentQuality],
              ["Template", analysis.templateScore],
            ].map(([label, value]) => (
              <li key={label}>
                <div className="ats-breakdown-row">
                  <span>{label}</span>
                  <strong>{value}%</strong>
                </div>
                <Bar value={value} />
              </li>
            ))}
          </ul>

          <h3>Skills matrix</h3>
          <p className="muted small">
            Required: {analysis.skillsMatrix?.requiredCount ?? 0}
            {" · "}Matched: {analysis.skillsMatrix?.matchedCount ?? 0}
            {" · "}Missing: {analysis.skillsMatrix?.missingCount ?? 0}
          </p>
          <div className="ats-table-wrap">
            <table className="ats-table">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Required</th>
                  <th>Resume</th>
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {(analysis.skillsMatrix?.rows || []).map((row) => (
                  <tr key={`${row.skill}-${row.importance}`}>
                    <td>
                      {row.skill}
                      <EvidenceTag level={row.evidence} />
                    </td>
                    <td>{row.importance === "required" ? "Yes" : "Preferred"}</td>
                    <td>{row.found ? "Yes" : "No"}</td>
                    <td>{row.matchScore}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(analysis.missingSkills || []).length > 0 && (
            <p className="ats-missing">
              Missing skills: {analysis.missingSkills.join(", ")}
            </p>
          )}

          <h3>Project analysis</h3>
          {(analysis.projectMatrix || []).length === 0 ? (
            <p className="muted small">No projects listed.</p>
          ) : (
            (analysis.projectMatrix || []).map((p) => (
              <div className="ats-card" key={p.name}>
                <strong>{p.name}</strong>
                <ul className="ats-mini-list">
                  <li>Role relevance: {p.roleRelevance}%</li>
                  <li>Technical skills: {p.technicalSkills}%</li>
                  <li>Description quality: {p.descriptionQuality}%</li>
                  <li>Bullet quality: {p.bulletQuality ?? "—"}%</li>
                  <li>Impact: {p.impact}%</li>
                  <li>
                    Technologies: {(p.technologies || []).length ? p.technologies.join(" | ") : "—"}
                    {" "}({p.technologiesScore ?? "—"}%)
                  </li>
                  <li>
                    Project URL: {p.urlProvided ? "✓ Provided" : (p.urlLabel || "Optional / Not provided")}
                  </li>
                  <li>Overall: {p.overall}%</li>
                </ul>
                {(p.missing || []).length > 0 && (
                  <p className="muted small">{p.missing[0]}</p>
                )}
              </div>
            ))
          )}

          <h3>Experience analysis</h3>
          <div className="ats-card">
            <ul className="ats-mini-list">
              <li>Role relevance: {analysis.experienceMatrix?.roleRelevance ?? 0}%</li>
              <li>Skill evidence: {analysis.experienceMatrix?.skillEvidence ?? 0}%</li>
              <li>Achievement quality: {analysis.experienceMatrix?.achievementQuality ?? 0}%</li>
              <li>Estimated years: {analysis.experienceMatrix?.years ?? 0}</li>
            </ul>
            {(analysis.experienceMatrix?.notes || []).map((n) => (
              <p className="muted small" key={n}>{n}</p>
            ))}
            {(analysis.experienceMatrix?.jobs || []).map((job) => (
              <p className="muted small" key={`${job.role}-${job.company}`}>
                {job.role}{job.company ? ` · ${job.company}` : ""} — relevance {job.relevance}%, achievements {job.achievementQuality}%
              </p>
            ))}
          </div>

          <h3>Certifications</h3>
          {(analysis.certificationMatrix || []).length === 0 ? (
            <p className="muted small">No certifications listed.</p>
          ) : (
            <ul className="ats-cert-list">
              {(analysis.certificationMatrix || []).map((c) => (
                <li key={c.name}>
                  <strong>{c.name}</strong>
                  <span>{c.relevance} ✓</span>
                  <div className="muted small">
                    Certificate: {c.urlProvided ? "✓ Certificate URL provided" : (c.urlLabel || "Optional / Not provided")}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h3>Education</h3>
          {(analysis.educationAnalysis?.items || []).length === 0 ? (
            <p className="muted small">No education listed.</p>
          ) : (
            (analysis.educationAnalysis.items || []).map((ed) => (
              <p className="muted small" key={ed.heading}>
                {ed.heading}
                {ed.institution ? ` — ${ed.institution}` : ""} · {ed.relevance}
              </p>
            ))
          )}

          <h3>Keyword analysis</h3>
          <p className="muted small">
            Required: {analysis.keywordAnalysis?.requiredCount ?? 0}
            {" · "}Matched: {analysis.keywordAnalysis?.matchedCount ?? 0}
            {" · "}Missing: {analysis.keywordAnalysis?.missingCount ?? 0}
            {" · "}Match: {analysis.keywordMatch}%
          </p>
          {(analysis.missingKeywords || []).length > 0 && (
            <p className="ats-missing">
              Missing keywords: {analysis.missingKeywords.join(", ")}
            </p>
          )}
          <p className="muted small">Add missing keywords only where they accurately describe your work. Do not stuff keywords.</p>

          <h3>ATS formatting</h3>
          <p className="muted small">
            {analysis.atsFormatting}/100
            {analysis.templateAnalysis?.name ? ` · Template: ${analysis.templateAnalysis.name}` : ""}
          </p>
          {(analysis.formattingIssues || []).length > 0 && (
            <ul className="ats-mini-list">
              {analysis.formattingIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}

          <h3>Template ATS analysis</h3>
          {analysis.templateAnalysis && (
            <ul className="ats-mini-list">
              <li>ATS compatibility: {analysis.templateAnalysis.atsCompatibility}/100</li>
              <li>Reading order: {analysis.templateAnalysis.readingOrder}/100</li>
              <li>Typography: {analysis.templateAnalysis.typography}/100</li>
              <li>Section structure: {analysis.templateAnalysis.sectionStructure}/100</li>
              <li>Machine readability: {analysis.templateAnalysis.machineReadability}/100</li>
              <li>Photo usage: {analysis.templateAnalysis.photoUsage}</li>
            </ul>
          )}

          <h3>Section-by-section</h3>
          <ul className="ats-mini-list">
            {(analysis.sectionAnalysis || []).map((s) => (
              <li key={s.section}>
                {s.section}: {s.score}/100 — {s.note}
              </li>
            ))}
          </ul>

          <h3>Top strengths</h3>
          <ul className="ats-good">
            {(analysis.strengths || []).map((s) => (
              <li key={s}>✓ {s}</li>
            ))}
          </ul>

          <h3>Areas to improve</h3>
          <ul className="ats-warn">
            {(analysis.weaknesses || []).map((s) => (
              <li key={s}>⚠ {s}</li>
            ))}
          </ul>

          <h3>Recommended actions</h3>
          <ol className="ats-recs">
            {(analysis.recommendations || []).map((r) => (
              <li key={r.text}>
                <span className={`ats-priority ats-priority-${(r.priority || "LOW").toLowerCase()}`}>
                  {r.priority || "LOW"}
                </span>
                {r.text}
              </li>
            ))}
          </ol>

          <div className="ats-rewrite-actions">
            <button className="btn btn-primary" type="button" onClick={onRewrite} disabled={rewriting}>
              {rewriting ? "Rewriting…" : "Rewrite resume for this role"}
            </button>
          </div>
          {rewriteError && <p className="alert ats-error">{rewriteError}</p>}

          {rewriteResult && (
            <div className="ats-rewrite-preview">
              <h3>Resume rewrite</h3>
              <p className="muted small">
                Target role: {targetRole}
                {rewriteResult.usedJobDescription ? " · Job description: provided" : " · Job description: not provided"}
              </p>
              <div className="ats-rewrite-scores">
                <div>
                  <span className="ats-kicker">Before</span>
                  <strong>{rewriteResult.estimatedScoreBefore} / 100</strong>
                  <StarRating value={rewriteResult.starRatingBefore} />
                </div>
                <div>
                  <span className="ats-kicker">Estimated after</span>
                  <strong>{rewriteResult.estimatedScoreAfter} / 100</strong>
                  <StarRating value={rewriteResult.starRatingAfter} />
                </div>
                <div>
                  <span className="ats-kicker">Improvement</span>
                  <strong className={rewriteResult.estimatedScoreAfter - rewriteResult.estimatedScoreBefore >= 0 ? "ats-delta-up" : "ats-delta-down"}>
                    {rewriteResult.estimatedScoreAfter - rewriteResult.estimatedScoreBefore >= 0 ? "+" : ""}
                    {rewriteResult.estimatedScoreAfter - rewriteResult.estimatedScoreBefore} points
                  </strong>
                </div>
              </div>
              <ul className="ats-mini-list">
                <li>Role match: {rewriteResult.before?.roleMatch}% → {rewriteResult.after?.roleMatch}%</li>
                <li>Skills match: {rewriteResult.before?.skillsMatch}% → {rewriteResult.after?.skillsMatch}%</li>
                <li>Keyword match: {rewriteResult.before?.keywordMatch}% → {rewriteResult.after?.keywordMatch}%</li>
                <li>Project match: {rewriteResult.before?.projectsScore}% → {rewriteResult.after?.projectsScore}%</li>
              </ul>
              <h4 className="ats-rewrite-changes-title">Changes made</h4>
              <ul className="ats-good">
                {(rewriteResult.changes || []).map((change) => (
                  <li key={change}>✓ {change}</li>
                ))}
              </ul>
              <p className="muted small">{rewriteResult.integrityNote}</p>
              <div className="ats-rewrite-buttons">
                <button className="btn" type="button" onClick={onViewRewrite}>
                  {viewingRewrite ? "Viewing rewritten resume" : "View rewritten resume"}
                </button>
                <button className="btn btn-primary" type="button" onClick={onApplyRewrite}>
                  Apply rewrite
                </button>
                <button className="btn btn-ghost" type="button" onClick={onCancelRewrite}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {canUndo && !rewriteResult && (
            <div className="ats-rewrite-actions">
              <button className="btn" type="button" onClick={onUndoRewrite}>
                Undo rewrite
              </button>
              <p className="muted small">Restores the resume from before the last applied rewrite. Save after undoing if you want to keep it.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
