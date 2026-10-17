import React from "react";
import { ContactText, ProfilePhoto, StandardBody } from "./sections.jsx";

export default function PhotoElegant({ data }) {
  return (
    <div className="resume photo-elegant">
      <header className="resume-header">
        <div className="resume-header-text">
          <h1>{data.fullName || "Your Name"}</h1>
          {data.title && <p className="role">{data.title}</p>}
          <ContactText data={data} separator="  |  " />
        </div>
        <ProfilePhoto src={data.photo} variant="circle" />
      </header>
      <StandardBody
        data={data}
        summaryTitle="Summary"
        experienceTitle="Experience"
        experienceVariant="company-first"
      />
    </div>
  );
}
