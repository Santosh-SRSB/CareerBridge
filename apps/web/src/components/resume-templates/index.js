import PhotoProfessional from "./PhotoProfessional.jsx";
import PhotoExecutive from "./PhotoExecutive.jsx";
import PhotoModern from "./PhotoModern.jsx";
import PhotoCorporate from "./PhotoCorporate.jsx";
import PhotoElegant from "./PhotoElegant.jsx";
import ATSClassic from "./ATSClassic.jsx";
import ATSProfessional from "./ATSProfessional.jsx";
import ATSExecutive from "./ATSExecutive.jsx";
import ATSMinimal from "./ATSMinimal.jsx";
import ATSModern from "./ATSModern.jsx";
import ResumeTemplate01 from "./ResumeTemplate01.jsx";
import { resolveTemplateId } from "./helpers.js";

export const TEMPLATE_COMPONENTS = {
  "photo-professional": PhotoProfessional,
  "photo-executive": PhotoExecutive,
  "photo-modern": PhotoModern,
  "photo-corporate": PhotoCorporate,
  "photo-elegant": PhotoElegant,
  "ats-classic": ATSClassic,
  "ats-professional": ATSProfessional,
  "ats-executive": ATSExecutive,
  "ats-minimal": ATSMinimal,
  "ats-modern": ATSModern,
  "resume-template-01": ResumeTemplate01,
};

export function getTemplateComponent(id) {
  return TEMPLATE_COMPONENTS[resolveTemplateId(id)] || ATSMinimal;
}

export { resolveTemplateId };
