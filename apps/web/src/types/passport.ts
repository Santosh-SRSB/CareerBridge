export type PassportExperience = {
  years: string;
  company: string;
  jobTitle: string;
  stillInCompany: boolean;
  startDate: string;
  endDate: string;
  isInternship: boolean;
};

export type PassportDraft = {
  firstName: string;
  lastName: string;
  city: string;
  about: string;
  education: {
    qualification: string;
    institution: string;
    fieldOfStudy: string;
    yearCompleted: string;
  }[];
  stillInCollege: boolean;
  educationStart: string;
  educationEnd: string;
  experienceLevel: "fresher" | "experienced";
  totalExperienceYears: string;
  totalExperienceMonths: string;
  experience: PassportExperience[];
  gapReason: string;
  skills: string[];
  careerInterests: string[];
  source: "resume" | "manual";
};

export const EMPTY_EDUCATION = {
  qualification: "",
  institution: "",
  fieldOfStudy: "",
  yearCompleted: "",
};

export const EMPTY_EXPERIENCE: PassportExperience = {
  years: "",
  company: "",
  jobTitle: "",
  stillInCompany: false,
  startDate: "",
  endDate: "",
  isInternship: false,
};

export const EMPTY_DRAFT: PassportDraft = {
  firstName: "",
  lastName: "",
  city: "",
  about: "",
  education: [{ ...EMPTY_EDUCATION }],
  stillInCollege: false,
  educationStart: "",
  educationEnd: "",
  experienceLevel: "fresher",
  totalExperienceYears: "",
  totalExperienceMonths: "",
  experience: [{ ...EMPTY_EXPERIENCE }],
  gapReason: "",
  skills: [],
  careerInterests: [],
  source: "manual",
};

export const DRAFT_KEY = "careerbridge.passportDraft";
