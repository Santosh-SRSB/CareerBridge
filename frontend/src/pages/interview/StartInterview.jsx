import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api.js";

const DIFFICULTIES = [
  { id: "beginner", label: "Beginner" },
  { id: "standard", label: "Standard" },
  { id: "advanced", label: "Advanced" },
];

const COUNTS = [5, 10, 15];

export default function StartInterview() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState(params.get("resumeId") || "");
  const [roleTitle, setRoleTitle] = useState(params.get("roleTitle") || "");
  const [difficulty, setDifficulty] = useState("standard");
  const [questionCount, setQuestionCount] = useState(5);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listResumes();
        setResumes(list);
        if (!params.get("resumeId") && list[0]) setResumeId(String(list[0].id));
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [params]);

  async function handleStart() {
    if (!resumeId) {
      setError("Choose a resume to practice with.");
      return;
    }
    setStarting(true);
    setError("");
    try {
      const created = await api.createInterview({
        resumeId: Number(resumeId),
        roleTitle: roleTitle.trim() || "General Interview",
        difficulty,
        questionCount,
      });
      navigate(`/interviews/${created.interviewId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="interview-page">
      <p className="muted small"><Link to="/interviews">← Interview history</Link></p>
      <h1>Start Mock Interview</h1>
      <p className="muted">Text-only practice with coaching notes after each answer.</p>

      {error && <div className="alert">{error}</div>}

      <section className="form-section">
        <label>
          Resume
          <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            <option value="">Select a resume</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title || "Untitled resume"}
                {resume.data?.fullName ? ` — ${resume.data.fullName}` : ""}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="interview-fieldset">
          <legend>Target role</legend>
          <label className="checkbox-label">
            <input
              type="radio"
              name="role-mode"
              checked={!roleTitle || roleTitle === "General Interview"}
              onChange={() => setRoleTitle("General Interview")}
            />
            General Interview
          </label>
          <label>
            Role / target
            <input
              value={roleTitle === "General Interview" ? "" : roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="Data Analyst"
            />
          </label>
        </fieldset>

        <fieldset className="interview-fieldset">
          <legend>Difficulty</legend>
          {DIFFICULTIES.map((item) => (
            <label className="checkbox-label" key={item.id}>
              <input
                type="radio"
                name="difficulty"
                checked={difficulty === item.id}
                onChange={() => setDifficulty(item.id)}
              />
              {item.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="interview-fieldset">
          <legend>Question count</legend>
          {COUNTS.map((count) => (
            <label className="checkbox-label" key={count}>
              <input
                type="radio"
                name="count"
                checked={questionCount === count}
                onChange={() => setQuestionCount(count)}
              />
              {count} questions
            </label>
          ))}
        </fieldset>

        <button className="btn btn-primary" type="button" onClick={handleStart} disabled={starting}>
          {starting ? "Starting…" : "Start Interview"}
        </button>
      </section>
    </div>
  );
}
