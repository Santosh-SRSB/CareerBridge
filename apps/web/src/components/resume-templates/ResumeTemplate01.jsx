import React from "react";
import {
  Template01AchievementsCertifications,
  Template01Education,
  Template01Experience,
  Template01Header,
  Template01Projects,
  Template01Summary,
  Template01TechnicalSkills,
} from "./template01-sections.jsx";
import "./resume-template-01.css";

/** Default master resume template — matches reference PDF (black, serif, ATS-friendly) */
export default function ResumeTemplate01({ data }) {
  return (
    <div className="resume resume-template-01">
      <Template01Header data={data} />
      <Template01Summary data={data} />
      <Template01Experience data={data} />
      <Template01TechnicalSkills data={data} />
      <Template01Education data={data} />
      <Template01Projects data={data} />
      <Template01AchievementsCertifications data={data} />
    </div>
  );
}
