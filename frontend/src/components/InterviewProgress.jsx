import React from "react";

export default function InterviewProgress({ current, total }) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCurrent = Math.min(safeTotal, Math.max(1, Number(current) || 1));
  const percent = Math.round((safeCurrent / safeTotal) * 100);
  return (
    <div className="interview-progress" aria-label={`Question ${safeCurrent} of ${safeTotal}`}>
      <div className="interview-progress-label">Question {safeCurrent} of {safeTotal}</div>
      <div className="interview-progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
