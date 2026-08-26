require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const resumeRoutes = require("./routes/resumes");
const interviewRoutes = require("./routes/interviews");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "8mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// This backend only serves API routes under /api/*. Visiting the bare
// server URL in a browser is not how the app is meant to be used — the
// actual website is the frontend (npm run dev, http://localhost:5173).
// This friendly message replaces the generic 404 you'd otherwise see at "/".
app.get("/", (req, res) => {
  res.json({
    message: "Resume Builder API is running.",
    note: "This is the backend only. Open the frontend at http://localhost:5173 to use the app.",
    health: "/api/health",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/resumes", resumeRoutes);
app.use("/api/interviews", interviewRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.listen(PORT, () => {
  console.log(`Resume Builder API running at http://localhost:${PORT}`);
});
