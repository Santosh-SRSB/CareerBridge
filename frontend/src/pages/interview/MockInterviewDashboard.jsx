import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api.js";

function formatDate(value) {
  if (!value) return "In progress";
  try {
    return new Date(value).toLocaleDateString();
  } catch (err) {
    return value;
  }
}

export default function MockInterviewDashboard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setSessions(await api.listInterviews());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="interview-page">
      <div className="guidance-header">
        <div>
          <h1>Mock interviews</h1>
          <p className="muted">Practice role questions in writing, then review coaching notes.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => navigate("/interviews/new")}>
          Start Mock Interview
        </button>
      </div>

      {error && <div className="alert">{error}</div>}
      {loading && <p className="muted">Loading your interview history…</p>}

      {!loading && !sessions.length && (
        <div className="empty-state">
          <p>You have not completed a mock interview yet.</p>
          <button className="btn btn-primary" type="button" onClick={() => navigate("/interviews/new")}>
            Start your first interview
          </button>
        </div>
      )}

      <div className="resume-grid">
        {sessions.map((session) => (
          <div className="resume-card" key={session.id}>
            <div className="resume-card-body">
              <h3>{session.roleTitle}</h3>
              <p className="muted">{formatDate(session.completedAt || session.startedAt)}</p>
              <div className="template-badges">
                <span className={`badge ${session.status === "completed" ? "badge-good" : "badge-warn"}`}>
                  {session.overallBand || (session.status === "completed" ? "Completed" : "In progress")}
                </span>
                {session.overallScore != null && (
                  <span className="badge">{Math.round(session.overallScore)} / 100</span>
                )}
              </div>
              {session.status === "completed" ? (
                <Link className="btn btn-small" to={`/interviews/${session.id}/complete`}>View Feedback</Link>
              ) : (
                <Link className="btn btn-small" to={`/interviews/${session.id}`}>Continue</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
