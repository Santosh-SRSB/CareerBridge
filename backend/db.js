// db.js
// A tiny pure-JavaScript, file-based database. No native modules, no
// compiler, no external database server — just a JSON file on disk
// (resume_builder.db.json) that this module reads and writes safely.
//
// This intentionally trades scalability for zero install friction: it is
// meant for local development / learning, exactly like the original guide's
// suggestion to swap in PostgreSQL later once you're ready for production.

const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "resume_builder.db.json");

function loadRaw() {
  if (!fs.existsSync(DB_FILE)) {
    return { nextUserId: 1, nextResumeId: 1, users: [], resumes: [] };
  }
  try {
    const text = fs.readFileSync(DB_FILE, "utf8");
    return text.trim() ? JSON.parse(text) : { nextUserId: 1, nextResumeId: 1, users: [], resumes: [] };
  } catch (err) {
    throw new Error(`Could not read database file at ${DB_FILE}: ${err.message}`);
  }
}

function saveRaw(state) {
  // Write to a temp file then rename, so a crash mid-write can't corrupt the db file.
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpFile, DB_FILE);
}

function nowIso() {
  return new Date().toISOString();
}

const db = {
  // ---- users ----
  findUserByEmail(email) {
    const state = loadRaw();
    return state.users.find((u) => u.email === email) || null;
  },

  createUser({ name, email, passwordHash }) {
    const state = loadRaw();
    const user = {
      id: state.nextUserId,
      name,
      email,
      passwordHash,
      createdAt: nowIso(),
    };
    state.users.push(user);
    state.nextUserId += 1;
    saveRaw(state);
    return user;
  },

  // ---- resumes ----
  listResumesByUser(userId) {
    const state = loadRaw();
    return state.resumes
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },

  getResume(id, userId) {
    const state = loadRaw();
    return state.resumes.find((r) => r.id === id && r.userId === userId) || null;
  },

  createResume({ userId, title, templateId, data }) {
    const state = loadRaw();
    const resume = {
      id: state.nextResumeId,
      userId,
      title,
      templateId,
      data,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state.resumes.push(resume);
    state.nextResumeId += 1;
    saveRaw(state);
    return resume;
  },

  updateResume(id, userId, patch) {
    const state = loadRaw();
    const resume = state.resumes.find((r) => r.id === id && r.userId === userId);
    if (!resume) return null;
    Object.assign(resume, patch, { updatedAt: nowIso() });
    saveRaw(state);
    return resume;
  },

  deleteResume(id, userId) {
    const state = loadRaw();
    const before = state.resumes.length;
    state.resumes = state.resumes.filter((r) => !(r.id === id && r.userId === userId));
    const deleted = state.resumes.length < before;
    if (deleted) saveRaw(state);
    return deleted;
  },
};

module.exports = db;
