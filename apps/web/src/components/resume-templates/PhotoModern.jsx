import React from "react";
import { ContactText, ProfilePhoto, StandardBody } from "./sections.jsx";

export default function PhotoModern({ data }) {
  return (
    <div className="resume photo-modern">
      <header className="resume-header">
        <div className="resume-header-text">
          <h1>{data.fullName || "Your Name"}</h1>
          <div className="accent-rule" aria-hidden="true" />
          {data.title && <p className="role">{data.title}</p>}
          <ContactText data={data} />
        </div>
        <ProfilePhoto src={data.photo} variant="rounded" />
      </header>
      <StandardBody data={data} summaryTitle="Summary" experienceTitle="Experience" />
    </div>
  );
}
