export type FaqItem = { q: string; a: string };

export const SUPPORT_FAQS: Record<'candidate' | 'employer' | 'general', FaqItem[]> = {
  candidate: [
    {
      q: 'Is CareerBridge free for candidates?',
      a: 'Yes. Creating a Career Passport, browsing jobs, and using core practice tools is free for candidates. Employers fund hiring on the platform.',
    },
    {
      q: 'How do I build or update my Career Passport?',
      a: 'Sign in, open your profile or onboarding flow, and complete education, experience, skills, and links. You can edit details anytime from My Profile.',
    },
    {
      q: 'How does ATS resume scoring work?',
      a: 'Upload or build a resume, then open ATS Score. We check structure, keywords, and role fit. Scores guide improvements — they do not invent experience you did not provide.',
    },
    {
      q: 'How long does it take to hear back after I apply?',
      a: 'Response times are set by each employer. Most reply within about 10 business days. Track status anytime from Applications.',
    },
    {
      q: 'Can I practise interviews before applying?',
      a: 'Yes. Use AI Mock Interviews from the Interviews tab. Scores are for your practice and are not shared as job applications.',
    },
    {
      q: 'Why do you need location access on Jobs?',
      a: 'Location helps show nearby openings. You can deny GPS and still use your preferred city or pick a city manually.',
    },
    {
      q: 'How do I reset my password or change my email?',
      a: 'Use Forgot password on the login screen, or update contact details from Profile after signing in. Contact support if you are locked out.',
    },
    {
      q: 'Can I withdraw an application?',
      a: 'Open Applications, select the job, and use withdraw if the employer still allows it. For closed roles, contact the employer from the application thread if available.',
    },
  ],
  employer: [
    {
      q: 'How do I create an employer account?',
      a: 'Choose Employer on register or open Employer from the landing nav. Complete organisation details and verification steps when prompted.',
    },
    {
      q: 'How do I post a job?',
      a: 'After login, open Jobs → New job. Add role, location, skills, and publish. You can pause or close a posting anytime.',
    },
    {
      q: 'How does candidate matching work?',
      a: 'We match on skills, location, and passport strength. Shortlists stay in your Applications and Candidates views for review and interview scheduling.',
    },
    {
      q: 'How do I verify my organisation?',
      a: 'Verification usually needs a registered business email and confirmation details. Complete the KYC / verify steps in your employer workspace.',
    },
    {
      q: 'Can I schedule interviews from CareerBridge?',
      a: 'Yes. From Applications or Interviews, pick a candidate and set date, time, and mode. Candidates receive the invite through the platform notifications flow.',
    },
    {
      q: 'What happens if I delete a job someone applied to?',
      a: 'The posting becomes inactive. Candidates see that the job is no longer active on their Applications screen.',
    },
    {
      q: 'Where do billing and plan questions go?',
      a: 'Use employer Payments / billing in your workspace, or submit a support request with topic Employer partnerships.',
    },
  ],
  general: [
    {
      q: 'What is SRSB CareerBridge?',
      a: 'A career platform that helps candidates build a free Career Passport and helps employers hire with skill-based matching and interview tools.',
    },
    {
      q: 'How fast does support reply?',
      a: 'Most enquiries are answered within one business day. Urgent account lockouts are prioritised when you mark the topic clearly.',
    },
    {
      q: 'How do I report a bug or unsafe behaviour?',
      a: 'Submit a support request with topic Other and include screenshots, the page URL, and the time it happened. We escalate safety issues immediately.',
    },
    {
      q: 'Where can I read privacy and terms?',
      a: 'Links are available in the site footer and on registration screens. Employer-specific terms appear during employer onboarding.',
    },
    {
      q: 'Do you sell candidate data?',
      a: 'No. Candidate passport data is used to power matching and applications on CareerBridge under our privacy policy — not sold as a marketing list.',
    },
    {
      q: 'How do I contact support outside the form?',
      a: 'Email support through the contact block on this page, or use the Submit a request form so we can track your case with a reference.',
    },
  ],
};
