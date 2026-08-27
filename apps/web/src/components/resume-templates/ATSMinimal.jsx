import React from "react";
import { ContactText, StandardBody } from "./sections.jsx";

export default function ATSMinimal({ data }) {
  return (
    <div className="resume ats-minimal">
      <header>
        <h1>{data.fullName || "Your Name"}</h1>
        {data.title && <p className="role">{data.title}</p>}
        <ContactText data={data} />
      </header>
      <StandardBody data={data} summaryTitle="Summary" experienceTitle="Experience" />
    </div>
  );
}
