import React from "react";

export default function QuestionCard({ sequence, competency, question }) {
  return (
    <article className="question-card">
      {competency ? <p className="muted small">Focus: {competency}</p> : null}
      <h2>{sequence ? `Question ${sequence}` : "Interview question"}</h2>
      <p className="question-card-text">{question}</p>
    </article>
  );
}
