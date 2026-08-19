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
  skills: string[];
  source: "resume" | "manual";
};

export const EMPTY_DRAFT: PassportDraft = {
  firstName: "",
  lastName: "",
  city: "",
  about: "",
  education: [
    {
      qualification: "",
      institution: "",
      fieldOfStudy: "",
      yearCompleted: "",
    },
  ],
  skills: [],
  source: "manual",
};

export const DRAFT_KEY = "careerbridge.passportDraft";
