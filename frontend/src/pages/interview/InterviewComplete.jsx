import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";

export default function InterviewComplete() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        let data = await api.getInterview(id);
        if (data.status !== "completed") {
          data = await api.completeInterview(id);
        }
        setSession(data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id]);

  if (error) return <div className="interview-page alert">{error}</div>;
  if (!session) return <p className="muted interview-page">Preparing your interview summary…</p>;

  return (
    <div className="interview-page">
      <p className="muted small"><Link to="/interviews">← Interview history</Link></p>
      <h1>Interview complete</h1>
      <p className="guidance-headline">{session.roleTitle}</p>
      <div className="guidance-card">
        <div className="guidance-card-head">
          <h2>{session.overallBand || "Practice complete"}</h2>
          {session.overallScore != null && (
            <span className="badge badge-good">{Math.round(session.overallScore)} / 100</span>
          )}
        </div>
        <h3>Strengths</h3>
        <ul className="ats-good">
          {(session.strengths || []).map((item) => <li key={item}>{item}</li>)}
        </ul>
        <h3>Improve</h3>
        <ul>
          {(session.improve || []).map((item) => <li key={item}>{item}</li>)}
        </ul>
        <h3>Improvement plan</h3>
        <ul className="guidance-steps">
          {(session.improvementPlan || []).map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="ready-prompt-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate(`/interviews/new?resumeId=${session.resumeId}&roleTitle=${encodeURIComponent(session.roleTitle || "")}`)}
          >
            Practice Again
          </button>
          {session.resumeId ? (
            <Link className="btn" to={`/resumes/${session.resumeId}/career-guidance`}>
              See full career guidance
            </Link>
          ) : null}
        </div>
      </div>

      {(session.questions || []).filter((q) => q.answer).length > 0 && (
        <section className="guidance-card">
          <h2>Your answers</h2>
          {(session.questions || []).filter((q) => q.answer).map((q) => (
            <article key={q.id} className="interview-transcript">
              <h3>Question {q.sequence}</h3>
              <p>{q.question}</p>
              <p className="muted small">Your answer</p>
              <p>{q.answer}</p>
              {q.evaluation?.feedback ? <p>{q.evaluation.feedback}</p> : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
