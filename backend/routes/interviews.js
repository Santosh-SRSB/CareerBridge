const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { buildRoleProfile } = require("../services/roleKnowledge");
const { generateQuestion, evaluateAnswer, summarizeSession } = require("../services/interviewEngine");

const router = express.Router();

router.use(requireAuth);

const ALLOWED_DIFFICULTY = new Set(["beginner", "standard", "advanced"]);
const ALLOWED_COUNTS = new Set([5, 10, 15]);

function publicQuestion(row, { includeEvaluation = true } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    sequence: row.sequence,
    competency: row.competency,
    question: row.question,
    answer: row.answer || "",
    evaluation: includeEvaluation ? row.evaluation : undefined,
  };
}

function publicSession(session, questions = []) {
  const summary = session.summary || {};
  return {
    interviewId: session.id,
    id: session.id,
    resumeId: session.resumeId,
    roleTitle: session.roleTitle,
    difficulty: session.difficulty,
    questionCount: session.questionCount,
    currentQuestionIndex: session.currentQuestionIndex,
    status: session.status,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    overallScore: summary.overallScore,
    overallBand: summary.overallBand,
    strengths: summary.strengths || [],
    improve: summary.improve || [],
    improvementPlan: summary.improvementPlan || [],
    questions: questions.map((q) => publicQuestion(q)),
  };
}

function currentOpenQuestion(questions) {
  return questions.find((q) => !String(q.answer || "").trim()) || questions[questions.length - 1] || null;
}

router.post("/", (req, res) => {
  try {
    const body = req.body || {};
    const resumeId = Number(body.resumeId);
    if (!resumeId) return res.status(400).json({ error: "Choose a resume to practice with." });
    const resume = db.getResume(resumeId, req.userId);
    if (!resume) return res.status(404).json({ error: "Resume not found." });

    const roleTitle = String(body.roleTitle || resume.data?.targetRole || "General Interview").trim() || "General Interview";
    const difficulty = ALLOWED_DIFFICULTY.has(body.difficulty) ? body.difficulty : "standard";
    const questionCount = ALLOWED_COUNTS.has(Number(body.questionCount)) ? Number(body.questionCount) : 5;
    const roleProfile = buildRoleProfile(roleTitle);
    const generated = generateQuestion({ roleProfile, difficulty, askedCompetencies: [], askedQuestions: [] });

    const session = db.createInterviewSession({
      userId: req.userId,
      resumeId,
      roleTitle,
      difficulty,
      questionCount,
    });
    const question = db.addInterviewQuestion({
      sessionId: session.id,
      sequence: 1,
      competency: generated.competency,
      competencyKey: generated.competencyKey,
      question: generated.question,
    });
    db.updateInterviewSession(session.id, req.userId, {
      status: "in_progress",
      currentQuestionIndex: 0,
    });

    res.status(201).json({
      success: true,
      data: {
        interviewId: session.id,
        status: "STARTED",
        question: publicQuestion(question, { includeEvaluation: false }),
        questionCount,
        roleTitle,
        difficulty,
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("Create interview failed:", err);
    res.status(status).json({ error: err.message || "Could not start the interview." });
  }
});

router.get("/", (req, res) => {
  const sessions = db.listInterviewSessions(req.userId).map((session) => {
    const questions = db.listInterviewQuestions(session.id);
    return publicSession(session, questions);
  });
  res.json({ success: true, data: sessions });
});

router.get("/:id", (req, res) => {
  const session = db.getInterviewSession(Number(req.params.id), req.userId);
  if (!session) return res.status(404).json({ error: "Interview not found." });
  const questions = db.listInterviewQuestions(session.id);
  res.json({ success: true, data: publicSession(session, questions) });
});

router.post("/:id/answer", (req, res) => {
  try {
    const session = db.getInterviewSession(Number(req.params.id), req.userId);
    if (!session) return res.status(404).json({ error: "Interview not found." });
    if (session.status === "completed") {
      return res.status(400).json({ error: "This interview is already complete." });
    }

    const body = req.body || {};
    const questionId = Number(body.questionId);
    const answer = String(body.answer || "").trim();
    if (!answer) return res.status(400).json({ error: "Write an answer before submitting." });

    const questions = db.listInterviewQuestions(session.id);
    const current = questions.find((q) => q.id === questionId) || currentOpenQuestion(questions);
    if (!current) return res.status(400).json({ error: "No open question to answer." });
    if (String(current.answer || "").trim()) {
      return res.status(400).json({ error: "This question was already answered." });
    }

    const roleProfile = buildRoleProfile(session.roleTitle);
    const evaluation = evaluateAnswer({
      question: current.question,
      answer,
      roleProfile,
    });
    db.updateInterviewQuestion(current.id, session.id, { answer, evaluation });

    const answeredCount = questions.filter((q) => q.id === current.id || String(q.answer || "").trim()).length;
    const isLast = answeredCount >= session.questionCount;

    if (isLast) {
      return res.json({
        success: true,
        data: {
          evaluation,
          complete: true,
          nextQuestion: null,
        },
      });
    }

    const askedCompetencies = questions.map((q) => q.competencyKey || q.competency);
    const askedQuestions = questions.map((q) => q.question);
    const generated = generateQuestion({
      roleProfile,
      difficulty: session.difficulty,
      askedCompetencies,
      askedQuestions,
    });
    const next = db.addInterviewQuestion({
      sessionId: session.id,
      sequence: questions.length + 1,
      competency: generated.competency,
      competencyKey: generated.competencyKey,
      question: generated.question,
    });
    db.updateInterviewSession(session.id, req.userId, {
      status: "in_progress",
      currentQuestionIndex: next.sequence - 1,
    });

    res.json({
      success: true,
      data: {
        evaluation,
        complete: false,
        nextQuestion: publicQuestion(next, { includeEvaluation: false }),
      },
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("Interview answer failed:", err);
    res.status(status).json({ error: err.message || "Could not evaluate that answer." });
  }
});

router.post("/:id/complete", (req, res) => {
  try {
    const session = db.getInterviewSession(Number(req.params.id), req.userId);
    if (!session) return res.status(404).json({ error: "Interview not found." });
    const questions = db.listInterviewQuestions(session.id);
    const summary = summarizeSession(questions);
    const completed = db.completeInterviewSession(session.id, req.userId, summary);
    res.json({
      success: true,
      data: publicSession(completed, questions),
    });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("Complete interview failed:", err);
    res.status(status).json({ error: err.message || "Could not complete the interview." });
  }
});

module.exports = router;
