import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

function resumeId(resume) {
  const id = Number(resume && resume.id);
  return Number.isFinite(id) ? id : null;
}

export default function CareerGuidanceEntry() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listResumes();
        if (cancelled) return;
        const resumes = (Array.isArray(list) ? list : []).filter((item) => resumeId(item) != null);
        if (resumes.length === 1) {
          navigate(`/resumes/${resumeId(resumes[0])}/career-guidance`, { replace: true });
          return;
        }
        navigate("/", { replace: true });
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load your resumes.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="guidance-page">
        <div className="alert">
          <p>{error}</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/")}>
            Back to resumes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="guidance-page">
      <p className="muted">Finding a resume for Career Guidance…</p>
    </div>
  );
}
