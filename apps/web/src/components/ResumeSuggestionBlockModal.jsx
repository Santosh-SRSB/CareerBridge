import React, { useState, useMemo } from "react";

export default function ResumeSuggestionBlockModal({
  open,
  onClose,
  originalData,
  rewrittenData,
  targetRole = "",
  scoreBefore = null,
  scoreAfter = null,
  onApplyBlock,
  onApplyAll,
  onKeepAll,
  loading = false,
  onRefresh,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [approvedBlocks, setApprovedBlocks] = useState({}); // { [blockKey]: 'approved' | 'kept' }
  const [customDrafts, setCustomDrafts] = useState({});

  if (!open) return null;

  const orig = originalData || {};
  const sug = rewrittenData || {};

  // Compute block comparisons
  const hasSummaryDiff = Boolean(
    sug.summary && sug.summary.trim() !== (orig.summary || "").trim()
  );

  const origSkills = Array.isArray(orig.skills) ? orig.skills : [];
  const sugSkills = Array.isArray(sug.skills) ? sug.skills : [];
  const hasSkillsDiff = Boolean(
    sugSkills.length > 0 && sugSkills.join(",") !== origSkills.join(",")
  );

  const origExp = Array.isArray(orig.experience) ? orig.experience : [];
  const sugExp = Array.isArray(sug.experience) ? sug.experience : [];

  const origProj = Array.isArray(orig.projects) ? orig.projects : [];
  const sugProj = Array.isArray(sug.projects) ? sug.projects : [];

  function handleApproveSummary() {
    const textToApply = customDrafts.summary ?? sug.summary;
    onApplyBlock("summary", textToApply);
    setApprovedBlocks((prev) => ({ ...prev, summary: "approved" }));
  }

  function handleKeepSummary() {
    setApprovedBlocks((prev) => ({ ...prev, summary: "kept" }));
  }

  function handleApproveSkills() {
    onApplyBlock("skills", sugSkills);
    setApprovedBlocks((prev) => ({ ...prev, skills: "approved" }));
  }

  function handleKeepSkills() {
    setApprovedBlocks((prev) => ({ ...prev, skills: "kept" }));
  }

  function handleApproveJob(index) {
    const jobSug = sugExp[index];
    if (!jobSug) return;
    const nextExp = [...origExp];
    nextExp[index] = {
      ...nextExp[index],
      bullets: jobSug.bullets || nextExp[index].bullets,
    };
    onApplyBlock("experience", nextExp);
    setApprovedBlocks((prev) => ({ ...prev, [`exp_${index}`]: "approved" }));
  }

  function handleKeepJob(index) {
    setApprovedBlocks((prev) => ({ ...prev, [`exp_${index}`]: "kept" }));
  }

  function handleApproveProject(index) {
    const projSug = sugProj[index];
    if (!projSug) return;
    const nextProj = [...origProj];
    nextProj[index] = {
      ...nextProj[index],
      description: projSug.description ?? nextProj[index].description,
      bullets: projSug.bullets ?? nextProj[index].bullets,
    };
    onApplyBlock("projects", nextProj);
    setApprovedBlocks((prev) => ({ ...prev, [`proj_${index}`]: "approved" }));
  }

  function handleKeepProject(index) {
    setApprovedBlocks((prev) => ({ ...prev, [`proj_${index}`]: "kept" }));
  }

  function handleApproveAll() {
    onApplyAll(sug);
    onClose();
  }

  function handleKeepAllLocal() {
    if (onKeepAll) onKeepAll();
    onClose();
  }

  return (
    <div className="cb-suggestion-modal" role="dialog" aria-modal="true" aria-labelledby="cb-suggestion-title">
      <div className="cb-suggestion-backdrop" onClick={onClose} aria-hidden="true" />
      
      <div className="cb-suggestion-card">
        {/* Modal Header */}
        <div className="cb-suggestion-header">
          <div className="cb-suggestion-title-wrap">
            <div className="cb-suggestion-badge">AI Suggested Content</div>
            <h2 id="cb-suggestion-title" className="cb-suggestion-title">
              Candidate Review & Approval
            </h2>
            <p className="cb-suggestion-sub">
              {targetRole ? `Optimized for ${targetRole}. ` : ""}
              Review suggestions block by block. You have complete authority to approve or keep your original data.
            </p>
          </div>
          
          <button type="button" className="cb-suggestion-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Score delta & Quick Actions Bar */}
        <div className="cb-suggestion-score-bar">
          <div className="cb-suggestion-scores">
            {scoreBefore != null && (
              <span className="cb-score-tag">
                Original Score: <strong>{scoreBefore}/100</strong>
              </span>
            )}
            {scoreAfter != null && (
              <span className="cb-score-tag cb-score-tag--target">
                Target Score: <strong>{scoreAfter}/100</strong>
              </span>
            )}
            {scoreAfter != null && scoreBefore != null && (
              <span className="cb-score-tag cb-score-tag--gain">
                +{Math.max(0, scoreAfter - scoreBefore)} ATS points
              </span>
            )}
          </div>

          <div className="cb-suggestion-batch-actions">
            {onRefresh && (
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={onRefresh}
                disabled={loading}
              >
                {loading ? "Generating…" : "↻ Regenerate"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={handleKeepAllLocal}
            >
              Keep All My Data
            </button>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={handleApproveAll}
            >
              ✓ Approve All Suggestions
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="cb-suggestion-tabs">
          <button
            type="button"
            className={`cb-suggestion-tab ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Suggestions
          </button>
          <button
            type="button"
            className={`cb-suggestion-tab ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            Summary {hasSummaryDiff ? "•" : ""}
          </button>
          <button
            type="button"
            className={`cb-suggestion-tab ${activeTab === "skills" ? "active" : ""}`}
            onClick={() => setActiveTab("skills")}
          >
            Skills {hasSkillsDiff ? "•" : ""}
          </button>
          <button
            type="button"
            className={`cb-suggestion-tab ${activeTab === "experience" ? "active" : ""}`}
            onClick={() => setActiveTab("experience")}
          >
            Experience ({sugExp.length})
          </button>
          <button
            type="button"
            className={`cb-suggestion-tab ${activeTab === "projects" ? "active" : ""}`}
            onClick={() => setActiveTab("projects")}
          >
            Projects ({sugProj.length})
          </button>
        </div>

        {/* Blocks Body */}
        <div className="cb-suggestion-body">
          {loading ? (
            <div className="cb-suggestion-loading">
              <div className="cb-spinner" />
              <p>Generating tailored suggestions with Centralized AI Gateway…</p>
            </div>
          ) : (
            <>
              {/* BLOCK 1: PROFESSIONAL SUMMARY / OBJECTIVE */}
              {(activeTab === "all" || activeTab === "summary") && (
                <div className="cb-diff-card">
                  <div className="cb-diff-card-head">
                    <div className="cb-diff-card-info">
                      <span className="cb-diff-sec-name">Career Objective & Summary</span>
                      <span className="muted small">Tailored for ATS keyword ranking and clarity</span>
                    </div>
                    <div className="cb-diff-actions">
                      {approvedBlocks.summary === "approved" ? (
                        <span className="cb-status-badge cb-status-badge--approved">Reflected in Resume ✓</span>
                      ) : approvedBlocks.summary === "kept" ? (
                        <span className="cb-status-badge cb-status-badge--kept">Kept Original Data</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={handleKeepSummary}
                          >
                            Keep My Data
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={handleApproveSummary}
                          >
                            ✓ Approve & Apply
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="cb-diff-grid">
                    <div className="cb-diff-col cb-diff-col--orig">
                      <span className="cb-col-label">Your Current Data</span>
                      <div className="cb-col-content">
                        {orig.summary ? (
                          <p>{orig.summary}</p>
                        ) : (
                          <em className="muted">No summary provided</em>
                        )}
                      </div>
                    </div>
                    <div className="cb-diff-col cb-diff-col--sug">
                      <span className="cb-col-label">AI Suggested Improvement</span>
                      <div className="cb-col-content">
                        {sug.summary ? (
                          <p className="cb-suggested-highlight">{sug.summary}</p>
                        ) : (
                          <em className="muted">No suggestion generated</em>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOCK 2: SKILLS TAXONOMY & PRIORITIZATION */}
              {(activeTab === "all" || activeTab === "skills") && (
                <div className="cb-diff-card">
                  <div className="cb-diff-card-head">
                    <div className="cb-diff-card-info">
                      <span className="cb-diff-sec-name">Key Skills Prioritization</span>
                      <span className="muted small">Reordered to highlight role-relevant proficiencies first</span>
                    </div>
                    <div className="cb-diff-actions">
                      {approvedBlocks.skills === "approved" ? (
                        <span className="cb-status-badge cb-status-badge--approved">Reflected in Resume ✓</span>
                      ) : approvedBlocks.skills === "kept" ? (
                        <span className="cb-status-badge cb-status-badge--kept">Kept Original Data</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={handleKeepSkills}
                          >
                            Keep My Data
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={handleApproveSkills}
                          >
                            ✓ Approve & Apply
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="cb-diff-grid">
                    <div className="cb-diff-col cb-diff-col--orig">
                      <span className="cb-col-label">Your Current Skills</span>
                      <div className="cb-skill-chips-wrap">
                        {origSkills.length > 0 ? (
                          origSkills.map((s, i) => (
                            <span key={i} className="cb-skill-chip cb-skill-chip--orig">
                              {typeof s === "string" ? s : s.name}
                            </span>
                          ))
                        ) : (
                          <em className="muted">No skills listed</em>
                        )}
                      </div>
                    </div>
                    <div className="cb-diff-col cb-diff-col--sug">
                      <span className="cb-col-label">AI Suggested Skill Order</span>
                      <div className="cb-skill-chips-wrap">
                        {sugSkills.length > 0 ? (
                          sugSkills.map((s, i) => (
                            <span key={i} className="cb-skill-chip cb-skill-chip--sug">
                              {typeof s === "string" ? s : s.name}
                            </span>
                          ))
                        ) : (
                          <em className="muted">No skills reordered</em>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOCK 3: EXPERIENCE (ITEM BY ITEM) */}
              {(activeTab === "all" || activeTab === "experience") && (
                <>
                  {sugExp.length === 0 && origExp.length === 0 ? (
                    <div className="cb-empty-block muted">No experience entries in this resume.</div>
                  ) : (
                    sugExp.map((job, idx) => {
                      const origJob = origExp[idx] || {};
                      const blockKey = `exp_${idx}`;
                      const status = approvedBlocks[blockKey];

                      return (
                        <div key={idx} className="cb-diff-card">
                          <div className="cb-diff-card-head">
                            <div className="cb-diff-card-info">
                              <span className="cb-diff-sec-name">
                                Experience: {job.role || origJob.role || "Role"} {job.company ? `· ${job.company}` : ""}
                              </span>
                              <span className="muted small">Active action verbs & impact framing</span>
                            </div>
                            <div className="cb-diff-actions">
                              {status === "approved" ? (
                                <span className="cb-status-badge cb-status-badge--approved">Reflected in Resume ✓</span>
                              ) : status === "kept" ? (
                                <span className="cb-status-badge cb-status-badge--kept">Kept Original Data</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-small"
                                    onClick={() => handleKeepJob(idx)}
                                  >
                                    Keep My Data
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-small"
                                    onClick={() => handleApproveJob(idx)}
                                  >
                                    ✓ Approve & Apply
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="cb-diff-grid">
                            <div className="cb-diff-col cb-diff-col--orig">
                              <span className="cb-col-label">Your Current Bullets</span>
                              <ul className="cb-bullets-list">
                                {(origJob.bullets || []).filter(Boolean).length > 0 ? (
                                  (origJob.bullets || []).filter(Boolean).map((b, bIdx) => (
                                    <li key={bIdx}>{b}</li>
                                  ))
                                ) : (
                                  <li className="muted">No bullets written</li>
                                )}
                              </ul>
                            </div>
                            <div className="cb-diff-col cb-diff-col--sug">
                              <span className="cb-col-label">AI Suggested Bullets</span>
                              <ul className="cb-bullets-list cb-bullets-list--sug">
                                {(job.bullets || []).filter(Boolean).map((b, bIdx) => (
                                  <li key={bIdx}>{b}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}

              {/* BLOCK 4: PROJECTS (ITEM BY ITEM) */}
              {(activeTab === "all" || activeTab === "projects") && (
                <>
                  {sugProj.length === 0 && origProj.length === 0 ? (
                    <div className="cb-empty-block muted">No project entries in this resume.</div>
                  ) : (
                    sugProj.map((proj, idx) => {
                      const origP = origProj[idx] || {};
                      const blockKey = `proj_${idx}`;
                      const status = approvedBlocks[blockKey];

                      return (
                        <div key={idx} className="cb-diff-card">
                          <div className="cb-diff-card-head">
                            <div className="cb-diff-card-info">
                              <span className="cb-diff-sec-name">
                                Project: {proj.name || origP.name || "Project"}
                              </span>
                              <span className="muted small">Technical achievements & clarity</span>
                            </div>
                            <div className="cb-diff-actions">
                              {status === "approved" ? (
                                <span className="cb-status-badge cb-status-badge--approved">Reflected in Resume ✓</span>
                              ) : status === "kept" ? (
                                <span className="cb-status-badge cb-status-badge--kept">Kept Original Data</span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-small"
                                    onClick={() => handleKeepProject(idx)}
                                  >
                                    Keep My Data
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-small"
                                    onClick={() => handleApproveProject(idx)}
                                  >
                                    ✓ Approve & Apply
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="cb-diff-grid">
                            <div className="cb-diff-col cb-diff-col--orig">
                              <span className="cb-col-label">Your Current Project Content</span>
                              <p>{origP.description || "No description"}</p>
                              {Array.isArray(origP.bullets) && origP.bullets.length > 0 && (
                                <ul className="cb-bullets-list">
                                  {origP.bullets.filter(Boolean).map((b, bIdx) => (
                                    <li key={bIdx}>{b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div className="cb-diff-col cb-diff-col--sug">
                              <span className="cb-col-label">AI Suggested Content</span>
                              <p className="cb-suggested-highlight">{proj.description || ""}</p>
                              {Array.isArray(proj.bullets) && proj.bullets.length > 0 && (
                                <ul className="cb-bullets-list cb-bullets-list--sug">
                                  {proj.bullets.filter(Boolean).map((b, bIdx) => (
                                    <li key={bIdx}>{b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="cb-suggestion-footer">
          <p className="muted small">
            Design Principle: AI provides recommendations, but candidate retains 100% control over the final content.
          </p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done Reviewing
          </button>
        </div>
      </div>
    </div>
  );
}
