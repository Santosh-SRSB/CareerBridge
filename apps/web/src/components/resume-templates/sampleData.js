const PLACEHOLDER_PHOTO =
  "data:image/svg+xml," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#4A6274"/>
      <circle cx="128" cy="98" r="46" fill="#E6EEF3"/>
      <ellipse cx="128" cy="222" rx="82" ry="78" fill="#E6EEF3"/>
    </svg>
  `.trim());

export const SAMPLE_RESUME = {
  fullName: "Andrew Clark",
  title: "Experienced Project Manager | IT | Leadership | Cost Management",
  email: "andrew.clark@email.com",
  phone: "(555) 014-2098",
  location: "New York, NY",
  linkedin: "linkedin.com/in/andrewclark",
  website: "",
  photo: PLACEHOLDER_PHOTO,
  summary:
    "Project manager with 12+ years of experience leading cross-functional IT programs, improving delivery quality, and reducing operational cost. Skilled in stakeholder alignment, risk management, and building reliable delivery processes.",
  experience: [
    {
      company: "Microsoft",
      role: "Senior IT Project Manager",
      location: "New York, NY",
      startDate: "2021",
      endDate: "",
      current: true,
      bullets: [
        "Led enterprise implementation programs across product, engineering, and operations teams.",
        "Improved on-time delivery by 18% through clearer planning, risk tracking, and reporting.",
        "Reduced project overhead by 15% by standardizing vendor and budget controls.",
      ],
    },
    {
      company: "IBM",
      role: "Project Manager",
      location: "New York, NY",
      startDate: "2017",
      endDate: "2021",
      current: false,
      bullets: [
        "Managed multi-year infrastructure and application delivery programs.",
        "Coordinated stakeholders and vendors to keep scope, schedule, and budget aligned.",
      ],
    },
  ],
  education: [
    {
      id: "education-college-sample",
      level: "University",
      institution: "Columbia University",
      school: "Columbia University",
      degree: "M.S.",
      fieldOfStudy: "Information Systems",
      field: "Information Systems",
      location: "New York, NY",
      startDate: "2012",
      endDate: "2014",
      grade: "",
      gpa: "",
    },
    {
      id: "education-school-sample",
      level: "College",
      institution: "New York University",
      school: "New York University",
      degree: "B.S.",
      fieldOfStudy: "Business Administration",
      field: "Business Administration",
      location: "New York, NY",
      startDate: "2008",
      endDate: "2012",
      grade: "",
      gpa: "",
    },
  ],
  skills: [
    "Project Management",
    "Leadership",
    "Cost Management",
    "Risk Management",
    "Stakeholder Communication",
    "Agile",
    "Cloud Knowledge",
  ],
  projects: [
    {
      name: "Enterprise Delivery Playbook",
      description: "Created a reusable planning and reporting framework used across multiple IT programs.",
      link: "",
    },
  ],
  certifications: [
    { name: "PMP", issuer: "Project Management Institute", date: "2018" },
    { name: "Certified Scrum Master", issuer: "Scrum Alliance", date: "2016" },
  ],
};
