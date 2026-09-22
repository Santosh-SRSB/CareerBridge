export type TestimonialAudience = 'CANDIDATE' | 'EMPLOYER';
export type TestimonialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type TestimonialSource =
  | 'AFTER_5_APPLICATIONS'
  | 'AFTER_FIRST_MOCK_INTERVIEW'
  | 'PROFILE_80_COMPLETE'
  | 'DASHBOARD_SOFT_PROMPT'
  | 'FIRST_JOB_PUBLISHED'
  | 'AFTER_SHORTLIST_OR_INTERVIEW'
  | 'AFTER_HIRE_OR_SELECT'
  | 'MANUAL';

export type PublicTestimonial = {
  id: string;
  audience: TestimonialAudience;
  rating: number;
  quote: string;
  displayName: string;
  headline: string | null;
  createdAt: string;
};

export type TestimonialPromptView = {
  source: TestimonialSource;
  audience: TestimonialAudience;
  title: string;
  subtitle: string;
};

export type SubmitTestimonialPayload = {
  rating: number;
  quote: string;
  source?: TestimonialSource;
  displayName?: string;
  headline?: string;
};
