import React from "react";
import { ContactText, ProfilePhoto, StandardBody } from "./sections.jsx";

export default function PhotoProfessional({ data }) {
  return (
    <div className="resume photo-professional">
      <header className="resume-header">
        <div className="resume-header-text">
          <h1>{data.fullName || "Your Name"}</h1>
          {data.title && <p className="role">{data.title}</p>}
          <ContactText data={data} />
        </div>
        <ProfilePhoto src={data.photo} variant="circle" />
      </header>
      <StandardBody data={data} summaryTitle="Summary" experienceTitle="Experience" />
    </div>
  );
}
