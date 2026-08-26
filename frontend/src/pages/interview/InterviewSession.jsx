import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../api.js";
import InterviewProgress from "../../components/InterviewProgress.jsx";
import QuestionCard from "../../components/QuestionCard.jsx";
import AnswerInput from "../../components/AnswerInput.jsx";

export default function InterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState(null);
  const [nextQuestion, setNextQuestion] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");

  const questions = session?.questions || [];
  const openQuestion = questions.find((q) => !String(q.answer || "").trim()) || questions[questions.length - 1];
  const current = openQuestion;
  const sequence = current?.sequence || questions.length || 1;

  useEffect(() => {
    (async () => {
      try {
        const data = await api.getInterview(id);
        if (data.status === "completed") {
          navigate(`/interviews/${id}/complete`, { replace: true });
          return;
        }
        setSession(data);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [id, navigate]);

  async function handleSubmit() {
    if (!current || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await api.answerInterview(id, { questionId: current.id, answer });
      setEvaluation(result.evaluation);
      setNextQuestion(result.nextQuestion || null);
      if (result.complete) setNextQuestion(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    if (!nextQuestion && evaluation) {
      await finish();
      return;
    }
    setSession((prev) => ({
      ...prev,
      questions: [...(prev.questions || []).map((q) => (
        q.id === current.id ? { ...q, answer, evaluation } : q
      )), nextQuestion].filter(Boolean),
    }));
    setAnswer("");
    setEvaluation(null);
    setNextQuestion(null);
  }

  async function finish() {
    setEnding(true);
    try {
      await api.completeInterview(id);
      navigate(`/interviews/${id}/complete`);
    } catch (err) {
      setError(err.message);
      setEnding(false);
    }
  }

  if (error && !session) {
    return (
      <div className="interview-page">
        <div className="alert">{error}</div>
        <Link to="/interviews">Back to interviews</Link>
      </div>
    );
  }

  if (!session || !current) {
    return <p className="muted interview-page">Loading your interview question…</p>;
  }

  return (
    <div className="interview-page">
      <InterviewProgress current={sequence} total={session.questionCount} />
      <p className="muted small">{session.roleTitle} · {session.difficulty}</p>
      <QuestionCard sequence={sequence} competency={current.competency} question={current.question} />

      {!evaluation && (
        <>
          <AnswerInput value={answer} onChange={setAnswer} disabled={submitting} />
          {error && <div className="alert">{error}</div>}
          <div className="ready-prompt-actions">
            <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={submitting || !answer.trim()}>
              {submitting ? "Reviewing your answer…" : "Submit Answer"}
            </button>
            <button className="btn btn-ghost" type="button" onClick={finish} disabled={submitting || ending}>
              {ending ? "Ending…" : "End Interview"}
            </button>
          </div>
        </>
      )}

      {evaluation && (
        <section className="guidance-card">
          <h3>Coaching notes</h3>
          <p>{evaluation.feedback}</p>
          {(evaluation.strengths || []).length > 0 && (
            <>
              <h4>Strengths</h4>
              <ul className="ats-good">{evaluation.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            </>
          )}
          {(evaluation.improve || []).length > 0 && (
            <>
              <h4>Improve</h4>
              <ul>{evaluation.improve.map((item) => <li key={item}>{item}</li>)}</ul>
            </>
          )}
          {error && <div className="alert">{error}</div>}
          <button className="btn btn-primary" type="button" onClick={handleContinue} disabled={ending}>
            {nextQuestion ? "Next question" : (ending ? "Finishing…" : "See results")}
          </button>
        </section>
      )}
    </div>
  );
}
