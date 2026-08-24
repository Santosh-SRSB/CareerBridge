import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Editor from "./pages/Editor.jsx";
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
