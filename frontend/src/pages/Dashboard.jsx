import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

const BLANK_DATA = {
  fullName: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  website: "",
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  photo: null,
  targetRole: "",
  jobDescription: "",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listResumes();
      setResumes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      const resume = await api.createResume({
        title: "Untitled resume",
        templateId: "ats-minimal",
        data: BLANK_DATA,
      });
      navigate(`/resumes/${resume.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this resume? This can't be undone.")) return;
    try {
      await api.deleteResume(id);
      setResumes((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Your resumes</h1>
          <p className="muted">Create a resume once, then preview it in any template.</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "+ New resume"}
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : resumes.length === 0 ? (
        <div className="empty-state">
          <p>You don't have any resumes yet.</p>
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
            Create your first resume
          </button>
        </div>
      ) : (
        <div className="resume-grid">
          {resumes.map((r) => (
            <div key={r.id} className="resume-card" onClick={() => navigate(`/resumes/${r.id}`)}>
              <div className="resume-card-thumb">{r.data.fullName ? r.data.fullName[0] : "?"}</div>
              <div className="resume-card-body">
                <h3>{r.title}</h3>
                <p className="muted">{r.data.fullName || "No name yet"}</p>
                <span className="badge">{r.templateId}</span>
              </div>
              <button
                className="btn btn-ghost btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(r.id);
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
