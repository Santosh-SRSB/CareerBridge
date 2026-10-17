import React from "react";
import { ContactText, ProfilePhoto, StandardBody } from "./sections.jsx";

export default function PhotoCorporate({ data }) {
  return (
    <div className="resume photo-corporate">
      <header className="resume-header">
        <div className="resume-header-text">
          <h1>{data.fullName || "Your Name"}</h1>
          {data.title && <p className="role">{data.title}</p>}
          <ContactText data={data} />
        </div>
        <ProfilePhoto src={data.photo} variant="rounded" />
      </header>
      <StandardBody
        data={data}
        summaryTitle="Professional Summary"
        experienceTitle="Professional Experience"
        experienceVariant="role-first"
      />
    </div>
  );
}
