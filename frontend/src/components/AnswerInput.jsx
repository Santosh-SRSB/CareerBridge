import React from "react";

export default function AnswerInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Write your answer in a few sentences. Use a real example when you can.",
}) {
  return (
    <label className="answer-input">
      Your answer
      <textarea
        rows={8}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
