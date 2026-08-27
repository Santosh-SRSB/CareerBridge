import React from "react";
import { ContactText, StandardBody } from "./sections.jsx";

export default function ATSExecutive({ data }) {
  return (
    <div className="resume ats-executive">
      <header>
        <h1>{data.fullName || "Your Name"}</h1>
        {data.title && <p className="role">{data.title}</p>}
        <ContactText data={data} separator="  ·  " />
      </header>
      <StandardBody
        data={data}
        summaryTitle="Professional Summary"
        experienceTitle="Professional Experience"
        experienceVariant="company-first"
      />
    </div>
  );
}
