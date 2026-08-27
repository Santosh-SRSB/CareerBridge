import React from "react";
import { ContactText, ProfilePhoto, StandardBody } from "./sections.jsx";

export default function PhotoExecutive({ data }) {
  return (
    <div className="resume photo-executive">
      <header className="resume-header">
        <div className="resume-header-text">
          <h1>{data.fullName || "Your Name"}</h1>
          {data.title && <p className="role">{data.title}</p>}
          <ContactText data={data} separator="  ·  " />
        </div>
        <ProfilePhoto src={data.photo} variant="circle" />
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
