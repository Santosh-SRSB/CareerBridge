import type { LegalSection } from '@/components/legal/LegalPageShell';

export const CANDIDATE_TERMS_META = {
  title: 'Candidate Terms & Conditions',
  subtitle:
    'These Candidate Terms & Conditions (“Terms”) govern your access to and use of the SRSB CareerBridge application, website, platform, services, and related features (“Platform”) provided by SRSB Workforce Solutions Pvt. Ltd. (“SRSB”, “we”, “us”, or “our”).',
  effectiveDate: '21 September 2026',
  lastUpdated: '21 September 2026',
};

export const CANDIDATE_TERMS_INTRO = [
  'By registering for, accessing, or using CareerBridge, you acknowledge that you have read, understood, and agreed to these Terms.',
];

export const CANDIDATE_TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'eligibility',
    title: '1. Eligibility',
    bullets: [
      'You must provide accurate and complete information while creating your account and using the Platform.',
      'You are responsible for maintaining the accuracy of your profile, resume, qualifications, experience, skills, contact information, and other information submitted by you.',
      'You must not create an account using another person’s identity or provide false, misleading, forged, or fraudulent information.',
      'If you are below the applicable legal age for entering into such agreements, you should use the Platform only with the involvement and consent of your parent or legal guardian, where required by applicable law.',
    ],
  },
  {
    id: 'account',
    title: '2. Account Responsibility',
    bullets: [
      'You are responsible for maintaining the confidentiality of your login credentials and account.',
      'You are responsible for activities performed through your account unless caused by unauthorized access that was not reasonably preventable by you.',
      'You must immediately notify SRSB if you suspect unauthorized access to your account.',
      'SRSB may suspend or restrict accounts where there is suspected fraud, misuse, violation of these Terms, or violation of applicable law.',
    ],
  },
  {
    id: 'profile',
    title: '3. Candidate Profile and Information',
    paragraphs: [
      'You may voluntarily provide information to CareerBridge, including but not limited to full name, contact information, email, mobile number, resume/CV, educational qualifications, employment history, skills, certifications, projects, professional experience, job preferences, preferred work location, salary expectations, profile information, job application information, interview responses, audio or video recordings (where applicable), assessment results, and information generated through CareerBridge AI features.',
      'You agree that information submitted by you must be accurate, current, complete, and not intentionally misleading.',
    ],
  },
  {
    id: 'privacy',
    title: '4. Data Protection and Privacy',
    subsections: [
      {
        title: '4.1 Collection of Personal Data',
        paragraphs: [
          'SRSB may collect and process personal information that you voluntarily provide when you create or update your account, upload a resume, apply for a job, participate in an interview or assessment, use AI-powered features, communicate with employers or SRSB, contact support, or use Platform features that require additional information.',
          'Where technically necessary, certain information may also be collected automatically when you use the Platform, such as device information, login information, usage information, security logs, and technical information.',
          'Data will be provided only upon the information required as per the terms and conditions between SRSB and Candidates.',
        ],
      },
      {
        title: '4.2 Purpose of Processing',
        paragraphs: ['Your information may be processed for legitimate Platform-related purposes, including:'],
        bullets: [
          'Creating and maintaining your candidate profile',
          'Providing job recommendations and matching',
          'Processing job applications and facilitating employer communication',
          'Scheduling interviews',
          'Resume / profile / ATS analysis and AI-powered interview preparation',
          'Skills and skill-gap analysis and career recommendations',
          'Improving Platform functionality and security',
          'Preventing fraud, misuse, and unauthorized activity',
          'Customer support and, where applicable, processing payments for paid services',
          'Complying with applicable legal and regulatory requirements',
        ],
      },
      {
        title: '4.3 Data Sharing With Employers',
        paragraphs: [
          'When you apply for a job or otherwise use a CareerBridge feature that involves an employer, relevant information from your profile may be shared with the applicable employer or recruitment organization for legitimate recruitment purposes (such as name, contact details, resume, education, experience, skills, certifications, preferences, and relevant assessment information).',
          'SRSB does not authorize employers to use candidate information for unrelated purposes. Employers are responsible for handling candidate information in accordance with applicable data-protection and privacy laws.',
        ],
      },
      {
        title: '4.4 Candidate Control Over Applications',
        paragraphs: [
          'You acknowledge that submitting a job application may result in your relevant candidate information being made available to the employer associated with that vacancy.',
          'Once information has been shared with an employer for recruitment purposes, the employer may retain certain information in accordance with its own legal and business requirements.',
        ],
      },
      {
        title: '4.5–4.8 Service Providers, AI, Accuracy & Security',
        paragraphs: [
          'SRSB may use trusted third-party service providers (cloud hosting, authentication, messaging, payments, analytics, security, AI/ML, and related infrastructure). Where required by law, SRSB will take reasonable steps to ensure such providers process personal information only for authorized purposes.',
          'CareerBridge may use AI, machine-learning, or automated technologies for resume analysis, ATS scoring, skill identification, job matching, interview preparation, and related features. AI-generated results are assistive and should not be treated as an absolute or error-free assessment.',
          'You are responsible for ensuring that information submitted is accurate. SRSB may rely on information supplied by you.',
          'SRSB will take reasonable technical and organizational measures to protect personal information; however, no online platform can be guaranteed to be completely secure.',
        ],
      },
      {
        title: '4.9–4.15 Retention, Rights, Consent, Breaches & Privacy Policy',
        paragraphs: [
          'SRSB may retain personal information as reasonably necessary to provide services, maintain accounts and records, meet legal requirements, resolve disputes, and protect legitimate interests. When no longer required, information may be deleted, anonymized, or securely disposed of.',
          'Subject to applicable law, you may request access, correction, deletion (where legally applicable), information about processing, withdrawal of consent where processing is based on consent, and other rights under applicable data-protection laws.',
          'Withdrawal of consent will not affect processing lawfully carried out before withdrawal or otherwise permitted by law. Withdrawal of certain permissions may affect your ability to use particular features.',
          'If SRSB becomes aware of a personal-data breach that requires notification under applicable law, SRSB will take appropriate steps in accordance with legal requirements.',
          'You should not upload sensitive or unnecessary information (including passwords, banking credentials, or government authentication credentials) unless specifically requested through an authorized secure process.',
          'Depending on technology providers, information may be processed or stored outside your state or country, subject to applicable law and the CareerBridge Privacy Policy.',
          'The CareerBridge Privacy Policy forms an important part of your use of CareerBridge and should be read together with these Terms.',
        ],
      },
    ],
  },
  {
    id: 'applications',
    title: '5. Job Applications',
    bullets: [
      'CareerBridge may allow you to discover and apply for employment opportunities listed by employers or recruitment partners.',
      'Applying for a job does not guarantee an interview, selection, offer, employment, salary, or joining.',
      'Final recruitment decisions are made by the relevant employer or hiring organization.',
      'Employers may independently verify information provided by candidates.',
      'You are responsible for reviewing the job description, location, compensation, qualifications, and other applicable conditions before applying.',
      'SRSB does not guarantee that every job listing will remain available or that an employer will respond to an application.',
    ],
  },
  {
    id: 'documents',
    title: '6. Resume and Document Information',
    paragraphs: [
      'You represent that you have the right to submit your resume and other documents; that the information does not knowingly violate third-party rights; that you will not upload malicious files or unlawful material; and that you will not intentionally provide fraudulent or misleading information.',
      'SRSB may use automated technologies to parse, organize, analyze, and extract information from uploaded resumes and documents for Platform functionality.',
    ],
  },
  {
    id: 'ai',
    title: '7. AI-Powered Features',
    paragraphs: [
      'CareerBridge may provide AI-based features such as resume analysis, ATS or profile assessment, skills and skill-gap analysis, career recommendations, interview preparation, mock interviews, communication analysis, personalized improvement suggestions, and job/profile matching.',
      'AI-generated results are provided for informational and career-support purposes. They should not be treated as a guarantee of employment, professional certification, or a definitive assessment of your abilities. You should independently review important information before relying upon it.',
    ],
  },
  {
    id: 'interviews',
    title: '8. Interview and Assessment Features',
    bullets: [
      'Where the Platform provides audio, video, text, or AI-based interview functionality, you consent to the processing of information necessary to provide the feature.',
      'Your responses may be analyzed to generate feedback or assessment results.',
      'Assessment results may be used to improve your profile, interview preparation, or other Platform functionality, subject to the Privacy Policy.',
      'AI-generated assessment scores are not a guarantee of employer selection.',
    ],
  },
  {
    id: 'communication',
    title: '9. Communication',
    paragraphs: [
      'By using CareerBridge, you may receive service-related communications including account verification, application updates, interview notifications, job alerts, scheduling notifications, Platform and security notifications, and account-related communications.',
      'Where permitted by applicable law and based on your preferences or consent, you may also receive promotional or career-related communications.',
    ],
  },
  {
    id: 'conduct',
    title: '10. Candidate Conduct',
    paragraphs: ['You must not:'],
    bullets: [
      'Provide false or fraudulent information or impersonate another person',
      'Upload malicious software or harmful files',
      'Attempt unauthorized access to another account or circumvent Platform security',
      'Scrape, copy, reproduce, or commercially exploit Platform data without authorization',
      'Use the Platform for unlawful purposes',
      'Harass, threaten, discriminate against, or abuse other users',
      'Submit fraudulent job applications or manipulate assessments or interview results',
      'Use AI or other tools to misrepresent your identity or qualifications',
      'Upload content that violates applicable law or third-party rights',
      'Use another person’s personal information without authorization',
    ],
  },
  {
    id: 'matching',
    title: '11. Job Matching',
    paragraphs: [
      'CareerBridge may use information such as skills, qualifications, experience, job preferences, and location to provide job recommendations or matching. Matching results are automated or technology-assisted recommendations and do not guarantee suitability, selection, interview, or employment.',
    ],
  },
  {
    id: 'paid',
    title: '12. Paid Services',
    paragraphs: [
      'Certain CareerBridge features may be offered on a paid basis. Before purchasing, the applicable price, taxes, duration, features, and payment terms will be presented to you.',
      'Unless otherwise stated at the time of purchase: fees are payable per Platform terms; access may depend on successful payment; applicable taxes may be charged separately; and refunds, cancellations, or credits follow the purchase/refund policy displayed at purchase.',
    ],
  },
  {
    id: 'ip',
    title: '13. Intellectual Property',
    paragraphs: [
      'The Platform, including its software, design, interface, branding, content, technology, and features, belongs to SRSB or its respective licensors and is protected by applicable intellectual-property laws.',
      'You may use the Platform only for its intended employment and career-related purposes. You retain ownership of information and content that you submit, subject to the rights necessary for SRSB to operate and provide the Platform and services.',
    ],
  },
  {
    id: 'third-party',
    title: '14. Third-Party Services',
    paragraphs: [
      'CareerBridge may integrate with or provide links to third-party services. SRSB is not responsible for the independent policies, availability, security, or practices of third-party services.',
    ],
  },
  {
    id: 'availability',
    title: '15. Platform Availability',
    paragraphs: [
      'SRSB will make reasonable efforts to maintain CareerBridge; however, the Platform may occasionally be unavailable due to maintenance, upgrades, technical issues, connectivity problems, security incidents, or circumstances beyond SRSB’s reasonable control.',
    ],
  },
  {
    id: 'suspension',
    title: '16. Suspension or Termination',
    paragraphs: [
      'SRSB may suspend, restrict, or terminate access to an account where reasonably necessary due to violation of these Terms, fraudulent or unlawful activity, security concerns, misuse of the Platform, requests required by law, or other legitimate operational or security reasons.',
      'You may request deletion or closure of your account subject to applicable legal, contractual, security, and record-retention requirements.',
    ],
  },
  {
    id: 'no-guarantee',
    title: '17. No Employment Guarantee',
    paragraphs: [
      'CareerBridge is an employment and career-support platform. SRSB does not guarantee employment, interview selection, job placement, a particular salary or employer, a particular number of job opportunities, acceptance of an application, or successful completion of an interview or assessment.',
    ],
  },
  {
    id: 'liability',
    title: '18. Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by applicable law, SRSB shall not be responsible for indirect, incidental, consequential, or special losses arising from the use of the Platform, including losses arising from an employer’s recruitment decision, inaccurate information submitted by another user, third-party services, or temporary Platform unavailability.',
      'Nothing in these Terms is intended to exclude or limit liability that cannot legally be excluded or limited under applicable law.',
    ],
  },
  {
    id: 'changes',
    title: '19. Changes to These Terms',
    paragraphs: [
      'SRSB may update these Terms from time to time. Updated Terms may be published within the Platform and will become effective as specified in the updated Terms. Where required by applicable law, SRSB will provide appropriate notice of material changes.',
    ],
  },
  {
    id: 'law',
    title: '20. Governing Law and Jurisdiction',
    paragraphs: [
      'These Terms shall be governed by the laws applicable in India. Subject to any mandatory legal requirements, disputes shall be subject to the jurisdiction of the competent courts at Bengaluru, Karnataka.',
    ],
  },
  {
    id: 'contact',
    title: '21. Contact',
    paragraphs: [
      'SRSB Workforce Solutions Pvt. Ltd.',
      '228/B, 55th Cross Road, Behind Ram Mandir Temple, 3rd Block, Rajajinagar, Bengaluru, Karnataka – 560010',
      'Email: info@srsbworkforcesolutions.com',
      'Website: https://srsbworkforcesolutions.com',
    ],
  },
];
