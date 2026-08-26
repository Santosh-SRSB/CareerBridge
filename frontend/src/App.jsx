import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Editor from "./pages/Editor.jsx";
import CareerGuidance from "./pages/CareerGuidance.jsx";
import CareerGuidanceEntry from "./pages/CareerGuidanceEntry.jsx";
import MockInterviewDashboard from "./pages/interview/MockInterviewDashboard.jsx";
import StartInterview from "./pages/interview/StartInterview.jsx";
import InterviewSession from "./pages/interview/InterviewSession.jsx";
import InterviewComplete from "./pages/interview/InterviewComplete.jsx";
import { clearSession, getCurrentUser } from "./api.js";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function TopBar() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const token = localStorage.getItem("token");

  function handleLogout() {
    clearSession();
    navigate("/login");
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brand-mark">RB</span> Resume Builder
      </Link>
      {token && (
        <nav className="topbar-nav">
          <Link to="/">Resumes</Link>
          <Link to="/interviews">Interviews</Link>
          <Link to="/career-guidance">Career Guidance</Link>
          <span className="topbar-user">{user?.name}</span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      )}
    </header>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <TopBar />
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews/new"
            element={
              <ProtectedRoute>
                <StartInterview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews/:id/complete"
            element={
              <ProtectedRoute>
                <InterviewComplete />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews/:id"
            element={
              <ProtectedRoute>
                <InterviewSession />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviews"
            element={
              <ProtectedRoute>
                <MockInterviewDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/career-guidance"
            element={
              <ProtectedRoute>
                <CareerGuidanceEntry />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resumes/:id/career-guidance"
            element={
              <ProtectedRoute>
                <CareerGuidance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resumes/:id"
            element={
              <ProtectedRoute>
                <Editor />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
