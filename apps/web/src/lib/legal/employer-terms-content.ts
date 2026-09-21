import type { LegalSection } from '@/components/legal/LegalPageShell';

export const EMPLOYER_TERMS_META = {
  title: 'Employer Terms & Conditions',
  subtitle:
    'These Employer Terms & Conditions (“Employer Terms”) govern the registration and use of the SRSB CareerBridge Platform by employers, companies, organizations, recruiters, and authorized representatives (“Employer”, “you”, or “your”). CareerBridge is operated by SRSB Workforce Solutions Pvt. Ltd. (“SRSB”, “we”, “us”, or “our”).',
  effectiveDate: '21 September 2026',
  lastUpdated: '21 September 2026',
};

export const EMPLOYER_TERMS_INTRO = [
  'By creating an employer account or using employer features, you acknowledge that you have read, understood, and agreed to these Employer Terms.',
];

export const EMPLOYER_TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'eligibility',
    title: '1. Employer Eligibility and Authority',
    bullets: [
      'You represent that you are authorized to act on behalf of the organization you register.',
      'The information submitted during employer registration must be accurate and complete.',
      'You must provide valid company and authorized-representative information when requested.',
      'SRSB may request documents or information for verification purposes.',
    ],
  },
  {
    id: 'account',
    title: '2. Employer Account',
    paragraphs: ['The Employer is responsible for:'],
    bullets: [
      'Maintaining accurate company information',
      'Maintaining account security and protecting login credentials',
      'Restricting unauthorized access',
      'Updating outdated company or job information',
      'Activities performed through its account',
    ],
  },
  {
    id: 'jobs',
    title: '3. Job Requirements',
    paragraphs: [
      'Employers are responsible for ensuring that all job vacancies and requirements posted through CareerBridge are accurate.',
      'Job postings should clearly specify, where applicable: job title, description, required qualifications and skills, experience, work location, employment type, compensation or salary information, working conditions, and other relevant requirements.',
      'Employers must not knowingly publish false, misleading, discriminatory, unlawful, or fraudulent job opportunities.',
    ],
  },
  {
    id: 'candidate-info',
    title: '4. Candidate Information',
    paragraphs: [
      'Candidate information made available through CareerBridge is intended for legitimate recruitment and employment-related purposes.',
      'Employers must:',
    ],
    bullets: [
      'Use candidate information only for legitimate recruitment purposes',
      'Maintain appropriate confidentiality and security',
      'Not sell, redistribute, or commercially exploit candidate information',
      'Not use candidate information for unrelated marketing without appropriate legal basis or consent',
      'Not impersonate candidates or misrepresent employment opportunities',
      'Handle candidate information in accordance with applicable law',
    ],
  },
  {
    id: 'decisions',
    title: '5. Recruitment Decisions',
    paragraphs: [
      'The Employer is solely responsible for its hiring decisions, including interview selection, candidate and background verification, salary negotiation, employment terms, offer issuance, joining, rejection, and final employment decisions.',
      'SRSB CareerBridge does not guarantee that a candidate will be suitable for a particular role or that an employer will successfully hire a candidate.',
    ],
  },
  {
    id: 'matching',
    title: '6. Candidate Matching',
    paragraphs: [
      'CareerBridge may provide candidate matching or recommendations using skills, experience, qualifications, job requirements, location, and other relevant data.',
      'Matching results are technology-assisted recommendations and should not be considered a guarantee of candidate suitability. Employers remain responsible for conducting their own evaluation and verification.',
    ],
  },
  {
    id: 'contact',
    title: '7. Candidate Contact',
    paragraphs: [
      'Employers must use candidate contact information only for legitimate recruitment purposes associated with the relevant vacancy or recruitment activity.',
      'Employers must not engage in harassment, abusive communication, discriminatory practices, spam, or unauthorized solicitation.',
    ],
  },
  {
    id: 'conduct',
    title: '8. Employer Conduct',
    paragraphs: ['Employers must not:'],
    bullets: [
      'Post fraudulent vacancies',
      'Collect money from candidates in connection with recruitment where prohibited by applicable law',
      'Misrepresent salary, role, location, employment conditions, or company identity',
      'Request unnecessary sensitive personal information',
      'Discriminate unlawfully or harass candidates',
      'Use CareerBridge to distribute malware or harmful content',
      'Scrape or systematically extract Platform data without authorization',
      'Sell or redistribute candidate information',
      'Attempt unauthorized access or circumvent Platform security',
      'Use the Platform for unlawful purposes',
    ],
  },
  {
    id: 'verification',
    title: '9. Verification',
    paragraphs: [
      'SRSB may conduct reasonable verification of employer accounts, job postings, and other information. Verification by SRSB does not constitute a guarantee, certification, endorsement, or representation regarding an Employer or vacancy.',
    ],
  },
  {
    id: 'confidentiality',
    title: '10. Confidentiality',
    paragraphs: [
      'Employers must protect confidential candidate information and other non-public information obtained through CareerBridge.',
      'The Employer is responsible for implementing reasonable administrative, technical, and organizational safeguards appropriate to the information it receives.',
    ],
  },
  {
    id: 'payments',
    title: '11. Payments and Subscription Services',
    paragraphs: [
      'Certain employer services may require payment, subscription, recruitment fees, service charges, or other applicable charges.',
      'The applicable pricing, taxes, billing cycle, payment terms, cancellation terms, and service scope will be communicated or displayed before purchase or engagement. The Employer agrees to make payments in accordance with the applicable commercial terms.',
    ],
  },
  {
    id: 'recruitment-services',
    title: '12. Recruitment Services',
    paragraphs: [
      'Where the Employer separately engages SRSB for recruitment or staffing services, the relevant commercial agreement, work order, service agreement, NDA, recruitment terms, or other written agreement may apply in addition to these Terms.',
      'In the event of a conflict between these Terms and a separately executed written commercial agreement, the applicable commercial agreement will prevail to the extent of the conflict.',
    ],
  },
  {
    id: 'ip',
    title: '13. Intellectual Property',
    paragraphs: [
      "CareerBridge's software, interface, design, branding, technology, content, and other Platform materials are owned by SRSB or its licensors.",
      'Employers may not copy, reproduce, reverse engineer, modify, distribute, commercially exploit, or create derivative works from the Platform without appropriate authorization.',
      'Employers retain rights in their own company information and job content, while granting SRSB the necessary rights to host, display, process, and operate that content as part of CareerBridge services.',
    ],
  },
  {
    id: 'data-protection',
    title: '14. Data Protection and Privacy',
    paragraphs: [
      'Employers must comply with applicable data-protection and privacy laws when handling candidate information obtained through CareerBridge.',
      'The processing of personal information through the Platform is also subject to the applicable CareerBridge Privacy Policy.',
      'Employers should access only the information reasonably necessary for legitimate recruitment activities.',
      'Data will be provided only upon the information required as per the terms and conditions between SRSB and the Employer.',
    ],
  },
  {
    id: 'availability',
    title: '15. Platform Availability',
    paragraphs: [
      'SRSB will make reasonable efforts to maintain CareerBridge but does not guarantee uninterrupted or error-free availability.',
      'The Platform may be temporarily unavailable due to maintenance, upgrades, technical problems, security incidents, third-party dependencies, or circumstances beyond SRSB’s reasonable control.',
    ],
  },
  {
    id: 'suspension',
    title: '16. Suspension and Termination',
    paragraphs: [
      'SRSB may suspend, restrict, or terminate an Employer account or job posting where reasonably necessary due to violation of these Terms, fraudulent activity, misleading job postings, security concerns, misuse of candidate information, non-payment of applicable charges, violation of applicable law, or other legitimate operational or security reasons.',
    ],
  },
  {
    id: 'no-guarantee',
    title: '17. No Guarantee of Hiring',
    paragraphs: [
      'CareerBridge provides recruitment technology and related services. SRSB does not guarantee candidate availability or suitability, candidate acceptance of an offer, joining, employee retention, successful recruitment, a particular number of applications, or any specific hiring outcome, unless expressly agreed in a separate written commercial agreement.',
    ],
  },
  {
    id: 'third-party',
    title: '18. Third-Party Services',
    paragraphs: [
      'CareerBridge may rely on third-party technology, communication, payment, hosting, verification, AI, or other service providers. Third-party services may be subject to their own terms and policies.',
    ],
  },
  {
    id: 'liability',
    title: '19. Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by applicable law, SRSB shall not be liable for indirect, incidental, consequential, or special losses arising from the use of CareerBridge, including losses resulting from employer hiring decisions, candidate actions, inaccurate information supplied by users, third-party services, or temporary Platform unavailability.',
      'Nothing in these Terms excludes or limits liability that cannot legally be excluded or limited under applicable law.',
    ],
  },
  {
    id: 'changes',
    title: '20. Changes to Terms',
    paragraphs: [
      'SRSB may update these Terms from time to time. Updated Terms may be made available through the Platform and will become effective as stated in the updated Terms.',
    ],
  },
  {
    id: 'law',
    title: '21. Governing Law and Jurisdiction',
    paragraphs: [
      'These Terms shall be governed by the laws applicable in India. Subject to mandatory legal requirements, disputes shall be subject to the jurisdiction of the competent courts at Bengaluru, Karnataka.',
    ],
  },
  {
    id: 'contact-us',
    title: '22. Contact',
    paragraphs: [
      'SRSB Workforce Solutions Pvt. Ltd.',
      '228/B, 55th Cross Road, Behind Ram Mandir Temple, 3rd Block, Rajajinagar, Bengaluru, Karnataka – 560010',
      'Email: info@srsbworkforcesolutions.com',
      'Website: https://srsbworkforcesolutions.com',
    ],
  },
];
