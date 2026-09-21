import type { LegalSection } from '@/components/legal/LegalPageShell';

export const PRIVACY_META = {
  title: 'Privacy Policy',
  subtitle:
    'Privacy Policy of SRSB Workforce Solutions Pvt. Ltd. — how we collect, use, store, disclose, and protect your personal information on CareerBridge.',
  effectiveDate: '21 September 2026',
  lastUpdated: '21 September 2026',
};

export const PRIVACY_INTRO = [
  'SRSB Workforce Solutions Pvt. Ltd. ("Company", "we", "our", or "us") is committed to protecting the privacy and personal information of our clients, job applicants, employees, website visitors, and business partners.',
  'This Privacy Policy explains how we collect, use, store, disclose, and protect your personal information when you visit our website, interact with us, submit job applications, complete enquiry forms, or use our recruitment and staffing services.',
  'By accessing our website or providing your information, you agree to the practices described in this Privacy Policy.',
];

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: 'collect',
    title: '1. Information We Collect',
    paragraphs: ['We may collect the following categories of personal information:'],
    subsections: [
      {
        title: 'Personal Information',
        bullets: [
          'Full Name',
          'Mobile Number',
          'Email Address',
          'Residential City',
          'Postal Address (if required)',
          'Company Name',
          'Job Title',
        ],
      },
      {
        title: 'Recruitment Information',
        bullets: [
          'Resume / CV',
          'Educational Qualifications',
          'Employment History',
          'Skills and Certifications',
          'Salary Details (if voluntarily shared)',
          'Notice Period',
          'Preferred Work Location',
          'References (if provided)',
        ],
      },
      {
        title: 'Business Information (employers and clients)',
        bullets: [
          'Company Name',
          'Business Email',
          'Contact Number',
          'Hiring Requirements',
          'Billing Information',
          'GST Details (where applicable)',
        ],
      },
      {
        title: 'Website Usage Information',
        paragraphs: ['When you visit our website, we may automatically collect:'],
        bullets: [
          'IP Address',
          'Browser Type',
          'Device Information',
          'Operating System',
          'Pages Visited',
          'Time Spent on Website',
          'Cookies and Analytics Data',
        ],
      },
    ],
  },
  {
    id: 'use',
    title: '2. How We Use Your Information',
    paragraphs: ['We use your information to:'],
    bullets: [
      'Provide recruitment and staffing services.',
      'Match job seekers with suitable employment opportunities.',
      'Assist employers in fulfilling hiring requirements.',
      'Respond to enquiries and requests.',
      'Schedule interviews.',
      'Conduct candidate screening and profile sharing with prospective employers (with appropriate authorization or as part of the recruitment process).',
      'Improve our website and services.',
      'Send service updates and business communications.',
      'Comply with applicable legal and regulatory requirements.',
    ],
  },
  {
    id: 'sharing',
    title: '3. Information Sharing',
    paragraphs: [
      'We respect your privacy and do not sell your personal information.',
      'Your information may be shared only with:',
    ],
    bullets: [
      'Client organizations for recruitment purposes.',
      'Background verification partners (where applicable).',
      'Payroll and compliance partners (if required for employment).',
      'Government or regulatory authorities when legally required.',
      'Technology service providers assisting us in operating our business.',
      'Data will be provided only upon the information required as per the terms and conditions between SRSB, the Employer, and the Candidate.',
    ],
    subsections: [
      {
        title: '',
        paragraphs: ['All third parties are expected to protect your information appropriately.'],
      },
    ],
  },
  {
    id: 'security',
    title: '4. Data Security',
    paragraphs: [
      'We implement reasonable administrative, technical, and organizational measures to safeguard your personal information against unauthorized access, loss, misuse, disclosure, or alteration.',
      'While we strive to protect your information, no method of electronic transmission or storage can be guaranteed to be completely secure.',
    ],
  },
  {
    id: 'cookies',
    title: '5. Cookies',
    paragraphs: ['Our website may use cookies and similar technologies to:'],
    bullets: [
      'Improve website functionality.',
      'Understand visitor behavior.',
      'Analyze website traffic.',
      'Enhance user experience.',
    ],
    subsections: [
      {
        title: '',
        paragraphs: [
          'You may disable cookies through your browser settings; however, certain website features may not function properly.',
        ],
      },
    ],
  },
  {
    id: 'retention',
    title: '6. Data Retention',
    paragraphs: ['We retain personal information only for as long as necessary to:'],
    bullets: [
      'Deliver recruitment and staffing services.',
      'Maintain business records.',
      'Comply with legal, regulatory, and contractual obligations.',
      'Resolve disputes and enforce agreements.',
    ],
    subsections: [
      {
        title: '',
        paragraphs: [
          'When information is no longer required, it will be securely deleted or anonymized where appropriate.',
        ],
      },
    ],
  },
  {
    id: 'rights',
    title: '7. Your Rights',
    paragraphs: ['Subject to applicable law, you may request to:'],
    bullets: [
      'Access your personal information.',
      'Correct inaccurate or incomplete information.',
      'Update your contact details.',
      'Request deletion of your personal information, where legally permissible.',
      'Withdraw consent for marketing communications.',
    ],
    subsections: [
      {
        title: '',
        paragraphs: ['To exercise these rights, please contact us using the details below.'],
      },
    ],
  },
  {
    id: 'third-party',
    title: '8. Third-Party Links',
    paragraphs: [
      'Our website may contain links to external websites. We are not responsible for the privacy practices or content of those third-party websites. We encourage users to review the privacy policies of those websites before providing personal information.',
    ],
  },
  {
    id: 'children',
    title: "9. Children's Privacy",
    paragraphs: [
      'Our services are intended for individuals aged 18 years or older and for businesses. We do not knowingly collect personal information from children.',
    ],
  },
  {
    id: 'changes',
    title: '10. Changes to This Privacy Policy',
    paragraphs: [
      'We may update this Privacy Policy periodically to reflect changes in our business practices or legal requirements.',
      'The revised version will be published on this page with the updated effective date.',
    ],
  },
  {
    id: 'contact',
    title: '11. Contact Us',
    paragraphs: [
      'If you have any questions regarding this Privacy Policy or wish to exercise your privacy rights, please contact us:',
      'SRSB Workforce Solutions Pvt. Ltd.',
      'Email: info@srsbworkforcesolutions.com',
      'Website: https://www.srsbworkforcesolutions.com',
      'Office Address: 228/B, 55th Cross Road, Behind Ram Mandir Temple, 3rd Block, Rajajinagar, Bengaluru, Karnataka – 560010, India.',
    ],
  },
];
