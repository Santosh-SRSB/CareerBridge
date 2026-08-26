import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import SkillChip from "../components/SkillChip.jsx";

function bandClass(band) {
  if (band === "Excellent Match" || band === "Strong Match") return "badge-good";
  return "badge-warn";
}

export default function CareerGuidance() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setNotFound(false);
      setResult(null);
      const resumeId = Number(id);
      if (!Number.isFinite(resumeId)) {
        if (!cancelled) {
          setNotFound(true);
          setError("Resume not found.");
          setLoading(false);
        }
        return;
      }
      try {
        const data = await api.careerGuidance(resumeId);
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) {
          const message = err.message || "Resume not found.";
          setNotFound(/not found/i.test(message));
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const insufficient = Boolean(result?.insufficientContent);

  return (
    <div className="guidance-page">
      <div className="guidance-header">
        <div>
          <p className="muted small">
            <Link to={Number.isFinite(Number(id)) ? `/resumes/${id}` : "/"}>← Back to resume</Link>
          </p>
          <h1>Career Guidance</h1>
          {result?.overallReadiness?.headline && !insufficient ? (
            <p className="guidance-headline">{result.overallReadiness.headline}</p>
          ) : (
            <p className="muted">See which roles fit the skills already on your resume.</p>
          )}
        </div>
        {Number.isFinite(Number(id)) && (
          <button className="btn" type="button" onClick={() => navigate(`/interviews/new?resumeId=${id}`)}>
            Start Mock Interview
          </button>
        )}
      </div>

      {loading && (
        <div className="guidance-loading">
          Matching your resume against 30+ roles…
        </div>
      )}

      {error && (
        <div className="alert">
          <p>{error}</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate(notFound ? "/" : `/resumes/${id}`)}>
            {notFound ? "Back to resumes" : "Return to editor"}
          </button>
        </div>
      )}

      {!loading && !error && insufficient && (
        <div className="guidance-card">
          <h2>Add more to your resume first</h2>
          <p>{result.message || "Add skills, experience, or a project so we can recommend roles that fit your resume."}</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate(`/resumes/${id}`)}>
            Return to editor
          </button>
        </div>
      )}

      {!loading && !error && !insufficient && (result?.recommendations || []).map((role) => (
        <article className="guidance-card" key={role.roleId}>
          <div className="guidance-card-head">
            <h2>{role.roleTitle}</h2>
            <span className={`badge ${bandClass(role.matchBand)}`}>{role.matchBand}</span>
          </div>
          {role.matchScore != null && (
            <p className="muted small">Fit score {Math.round(role.matchScore)} / 100</p>
          )}
          <p>{role.whyThisRole}</p>
          <h3>Skills you already show</h3>
          <div className="skill-chip-row">
            {(role.matchedSkills || []).length
              ? role.matchedSkills.map((skill) => (
                <SkillChip key={skill} tone="good">{skill}</SkillChip>
              ))
              : <p className="muted small">No strong skill overlap yet — use the next steps below.</p>}
          </div>
          <h3>Skills to build</h3>
          {(role.missingSkills || []).length ? (
            <ul>
              {role.missingSkills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          ) : (
            <p className="muted small">No major skill gaps jumped out for this role.</p>
          )}
          <h3>Suggested next steps</h3>
          <ul className="guidance-steps">
            {(role.suggestedNextSteps || []).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate(`/interviews/new?resumeId=${id}&roleTitle=${encodeURIComponent(role.roleTitle)}`)}
          >
            Practice interview for this role
          </button>
        </article>
      ))}
    </div>
  );
}
