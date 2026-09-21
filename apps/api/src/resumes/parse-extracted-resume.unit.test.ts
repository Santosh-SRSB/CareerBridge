/**
 * Expanded regression tests for resume extraction pipeline.
 * Run: npm.cmd run test:resume-parse -w api
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatResumeDate,
  formatResumeDateRange,
  parseResumeDate,
} from '@careerbridge/shared';
import {
  classifyLanguageTokens,
  parseExtractedResumeText,
} from './parse-extracted-resume';
import { reconstructReadingOrder } from './pdf-reading-order';
import { splitLocationParts } from './resume-extract-normalize';

describe('Test A — single-column IT resume', () => {
  it('extracts core sections', () => {
    const content = parseExtractedResumeText(`
Priya Sharma
priya@mail.com | 9876543210 | Bengaluru, Karnataka

SUMMARY
Backend engineer.

WORK EXPERIENCE
Software Engineer
Acme Labs
Jan 2022 - Present
- Built APIs in Java

EDUCATION
B.Tech in Computer Science
NIT Example
2020

SKILLS
Java, SQL, AWS

PROJECTS
Inventory App
Warehouse tracking
Technologies: Java, SQL
`);
    assert.match(content.fullName, /Priya/i);
    assert.match(String(content.city), /Bengaluru/i);
    assert.ok(content.experiences.length >= 1);
    assert.equal(content.experiences[0].isCurrent, true);
    assert.equal(content.experiences[0].endDate ?? null, null);
    assert.ok(content.education.length >= 1);
    assert.ok(content.skills.some((s) => /java/i.test(s)));
    assert.ok((content.projects || []).some((p) => /Inventory/i.test(p.name)));
  });
});

describe('Test B — two-column reading order', () => {
  it('keeps left column experience separate from right column skills', () => {
    const ordered = reconstructReadingOrder([
      {
        num: 1,
        text: 'Experience\tSkills\nSoftware Engineer\tJava, SQL\nAcme Corp\tAWS\nJan 2022 - Present\tEnglish',
      },
    ]);
    assert.match(ordered.text, /Experience[\s\S]*Software Engineer[\s\S]*Skills/);
    assert.ok(ordered.pages[0].columnMode === 'two-column');

    const content = parseExtractedResumeText(ordered.text.replace(/^-- page \d+ --\s*/m, ''));
    // Skills section should capture tech; Languages-like tokens on sidebar may land in skills
    assert.ok(content.skills.length >= 1 || /java|sql|aws/i.test(JSON.stringify(content)));
  });
});

describe('Test C — non-IT resume', () => {
  it('parses sales experience without requiring tech headings', () => {
    const content = parseExtractedResumeText(`
Ravi Kumar
ravi@mail.com | Mumbai, Maharashtra

EMPLOYMENT HISTORY
Sales Manager
Retail Hub Pvt. Ltd.
2019 - 2024
- Managed regional accounts

EDUCATION
B.Com
City College
2018
`);
    assert.ok(content.experiences.length >= 1);
    assert.match(content.experiences[0].jobTitle, /Sales/i);
    assert.match(String(content.city), /Mumbai/i);
  });
});

describe('Test D — fresher resume', () => {
  it('extracts education and projects without experience', () => {
    const content = parseExtractedResumeText(`
Anita Das
anita@mail.com | Kolkata, West Bengal

OBJECTIVE
Seeking internship.

EDUCATION
BCA
State University
2025

ACADEMIC PROJECTS
Library System
Catalog management
`);
    assert.equal(content.experiences.length, 0);
    assert.ok(content.education.length >= 1);
    assert.ok((content.projects || []).length >= 1);
  });
});

describe('Test E — experienced multi-employer', () => {
  it('splits employers', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

EXPERIENCE
Founder and CEO
Nesting Probe Pvt. Ltd.
Jul 2024 - Present
- Roadmap

Senior Developer
InEight India
Feb 2016 - Jan 2017
- Modules
`);
    assert.ok(content.experiences.length >= 2);
  });
});

describe('Test F — resume without headings', () => {
  it('infers experience and education from content', () => {
    const content = parseExtractedResumeText(`
Sam Patel
sam@mail.com
Hyderabad, Telangana

Software Engineer | Contoso Technologies | Jan 2022 - Present
Built billing services.

B.Tech in Computer Science — XYZ University — 2021
`);
    assert.ok(content.experiences.length + content.education.length >= 1);
  });
});

describe('Test G — OCR-like noisy short text gating helper', () => {
  it('still parses sparse but valid text', () => {
    const content = parseExtractedResumeText(`
Name One
n@x.com
Skills
Java
`);
    assert.ok(content.skills.some((s) => /java/i.test(s)));
  });
});

describe('Test H — table-like tab cells', () => {
  it('handles tab separated skill rows', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

TECHNICAL SKILLS
Languages\tJava, SQL
Tools\tGit, Excel
`);
    assert.ok(content.skills.length >= 2);
  });
});

describe('Test I — technical languages under Languages', () => {
  it('routes programming tokens to skills/programmingLanguages', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

Languages
C, Objective-C, Swift, Kotlin, Java, JavaScript, MongoDB
`);
    assert.equal(content.languages.length, 0);
    assert.ok(content.skills.some((s) => /java/i.test(s)));
    assert.ok((content.programmingLanguages || []).length >= 1);
  });
});

describe('Test J — human languages', () => {
  it('keeps English/Hindi in languages', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

Languages
English, Hindi

PERSONAL DETAILS
Languages Known: Kannada
`);
    assert.ok(content.languages.some((l) => /english/i.test(l)));
    assert.ok(content.languages.some((l) => /hindi/i.test(l)));
  });
});

describe('Test K — 23 Sep 2024 - Present', () => {
  it('stores machine start date, isCurrent, null endDate', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

Experience
Lead Engineer
Acme Labs
23 Sep 2024 - Present
- Owned delivery
`);
    assert.equal(content.experiences[0].isCurrent, true);
    assert.equal(content.experiences[0].endDate ?? null, null);
    assert.equal(content.experiences[0].startDate, '2024-09-23');
    assert.equal(formatResumeDateRange(content.experiences[0].startDate, null, true), '23 SEP 2024 – PRESENT');
  });
});

describe('Test L — year-only range', () => {
  it('keeps years without inventing months', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

Experience
Analyst
ProdIntel
2024 - 2026
- Reporting
`);
    assert.equal(content.experiences[0].startDate, '2024');
    assert.equal(content.experiences[0].endDate, '2026');
    assert.equal(formatResumeDateRange('2024', '2026', false), '2024 – 2026');
  });
});

describe('Test M — Jan 2024 - Present', () => {
  it('does not invent a day', () => {
    const parsed = parseResumeDate('Jan 2024');
    assert.equal(parsed?.precision, 'month');
    assert.equal(formatResumeDate('Jan 2024'), 'JAN 2024');
    const content = parseExtractedResumeText(`
A
a@b.com

Experience
Engineer
Hexims
Jan 2024 - Present
- Work
`);
    assert.equal(content.experiences[0].startDate, '2024-01');
    assert.equal(content.experiences[0].isCurrent, true);
    assert.equal(formatResumeDateRange(content.experiences[0].startDate, null, true), 'JAN 2024 – PRESENT');
  });
});

describe('prose multi-employer (recruiter CV style)', () => {
  it('splits three employers from worked/working-as lines', () => {
    const content = parseExtractedResumeText(`
KEERTHI SAMPLE
sample@mail.com | 9999999999 | Bengaluru, Karnataka

● Worked as IT Recruiter at SYNCZI CONSULTING SERVICES from October 2020 to April 2022
● Worked as IT Recruiter at QUESS CORP LTD from April 2022 to May 2023.
● Working as Team Lead at INFINITE POTENTIAL DIGITAL MARKETING PRIVATE LIMITED from June 2023 to till date.

Responsibilities:
● Managing the team end to end process.

Languages known : Hindi, English, Konkani and Kannada

Personal Profile
Father's Name: Someone
Permanent Address: #1, 2nd cross, Bangalore -54
`);
    assert.ok(content.experiences.length >= 3, `got ${content.experiences.length}`);
    assert.ok(content.experiences.some((e) => /Team Lead/i.test(e.jobTitle) && e.isCurrent));
    assert.ok(content.languages.some((l) => /hindi/i.test(l)));
    assert.ok(content.languages.every((l) => !/bangalore|cross|address/i.test(l)));
    assert.ok(!(content.skills || []).some((s) => /father/i.test(s)));
    assert.match(String(content.city || ''), /Bengaluru/i);
    assert.doesNotMatch(content.fullName, /curriculum|vitae/i);
  });

  it('formats June 2023 till date as JUN 2023 – PRESENT', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

● Working as Team Leader at Company C from June 2023 to till date.
`);
    assert.equal(content.experiences[0].isCurrent, true);
    assert.equal(content.experiences[0].endDate ?? null, null);
    assert.equal(formatResumeDateRange(content.experiences[0].startDate, null, true), 'JUN 2023 – PRESENT');
  });
});

describe('education PUC / BCom split', () => {
  it('keeps separate education records', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

Academic Profile
● PUC in Vasavi Vidyanikethan College.
● BCom in Vasavi Vidyanikethan College. 2020
`);
    assert.ok(content.education.length >= 2);
    const blob = content.education.map((e) => e.qualification).join(' | ');
    assert.match(blob, /puc/i);
    assert.match(blob, /bcom|b\.?\s*com/i);
  });
});

describe('location splitting', () => {
  it('splits city/state/country and keeps long address out of city', () => {
    const a = splitLocationParts('Bengaluru, Karnataka, India');
    assert.equal(a.city, 'Bengaluru');
    assert.equal(a.state, 'Karnataka');
    assert.equal(a.country, 'India');

    const b = splitLocationParts('Village ABC, District XYZ, Bihar 845451');
    assert.ok(b.address);
    assert.ok(!b.city || !/Village ABC, District XYZ, Bihar/.test(b.city));
  });
});

describe('project / achievement boundaries', () => {
  it('stops projects at achievements', () => {
    const content = parseExtractedResumeText(`
A
a@b.com

PROJECTS
KGP Mall
Shopping platform

ACHIEVEMENTS
Employee of the Year

ROLE & RESPONSIBILITIES
Guide team members
`);
    assert.ok(!(content.projects || []).some((p) => /Employee|Guide team/i.test(p.name + (p.description || ''))));
    assert.ok((content.achievements || []).length >= 1);
    assert.ok(content.experiences.some((e) => (e.responsibilities || []).some((r) => /Guide team/i.test(r)) || /Guide team/i.test(e.description || '')));
  });
});

describe('classifyLanguageTokens', () => {
  it('separates human and tech', () => {
    const { human, tech } = classifyLanguageTokens(['English', 'Java', 'Xcode']);
    assert.ok(human.some((h) => /english/i.test(h)));
    assert.ok(tech.some((t) => /java/i.test(t)));
  });
});

describe('Plan A — fragmented bullet reflow', () => {
  it('joins wrap-continuation bullets into one responsibility', () => {
    const content = parseExtractedResumeText(`
Alex Candidate
alex@mail.com | Hyderabad, Telangana

WORK EXPERIENCE
Software Engineer
Nova Soft Pvt. Ltd.
Jan 2021 - Present
• Managed end-to-end hiring pipeline including screening
• and social network sourcing for technical roles.
• Built internal tooling for interview scheduling.
`);
    const blobs = (content.experiences[0]?.responsibilities || []).join(' | ');
    assert.match(blobs, /screening and social network/i);
    assert.ok(!blobs.split(' | ').some((b) => /^and social network/i.test(b.trim())));
    assert.match(blobs, /Built internal tooling/i);
  });
});

describe('Plan B/G — PII on skills line', () => {
  it('strips Father/DOB/address from skills and keeps tech tokens', () => {
    const content = parseExtractedResumeText(`
Sam Example
sam@mail.com | Pune, Maharashtra

SKILLS
Java, SQL, Father's Name: Someone, Date of Birth: 01-01-1995, Permanent Address: #12 2nd cross

WORK EXPERIENCE
Developer
Acme Labs
2022 - 2024
- Wrote services
`);
    assert.ok(content.skills.some((s) => /java/i.test(s)));
    assert.ok(content.skills.every((s) => !/father|dob|date of birth|cross|address/i.test(s)));
    assert.ok(content.personal?.address || content.fieldConfidence?.some((f) => /skill|personal|validation/i.test(f.source || f.field)));
  });
});

describe('Plan C — employer boundary on bullet company', () => {
  it('does not treat company-only bullets as responsibilities', () => {
    const content = parseExtractedResumeText(`
Pat Example
pat@mail.com | Chennai, Tamil Nadu

EXPERIENCE
• IT Recruiter
• Synczi Consulting Services Pvt. Ltd.
• Oct 2020 - Apr 2022
• Sourced candidates for java roles
• Worked as Developer at Hex Labs from May 2022 to Present
`);
    assert.ok(content.experiences.length >= 1);
    const allResp = content.experiences.flatMap((e) => e.responsibilities || []).join(' ');
    assert.ok(!/Synczi Consulting Services/i.test(allResp));
  });
});

describe('Plan D — wrapped prose dates', () => {
  it('joins from Month Year + to till date across lines', () => {
    const content = parseExtractedResumeText(`
Jo Example
jo@mail.com | Kochi, Kerala

• Working as Team Lead at Northwind Digital Pvt. Ltd. from
June 2023
to till date.
`);
    assert.ok(content.experiences.length >= 1);
    assert.equal(content.experiences[0].isCurrent, true);
    assert.match(String(content.experiences[0].startDate), /2023-06|2023/);
  });
});

describe('Plan E — near-duplicate experiences', () => {
  it('keeps distinct employers and collapses same-employer near-dupes', () => {
    const content = parseExtractedResumeText(`
Dup Example
dup@mail.com | Delhi, Delhi

WORK EXPERIENCE
• Worked as Analyst at Alpha Corp Ltd from Jan 2020 to Dec 2021
• Managed reporting dashboards for stakeholders across regions.
• Worked as Analyst at Alpha Corp Ltd from Jan 2020 to Dec 2021
• Managed reporting dashboards for stakeholders across regions and weekly reviews.
• Worked as Analyst at Beta Systems Pvt. Ltd from Jan 2022 to Present
• Built forecasting models.
`);
    assert.ok(content.experiences.length >= 2, `got ${content.experiences.length}`);
    assert.ok(content.experiences.some((e) => /Alpha/i.test(e.company)));
    assert.ok(content.experiences.some((e) => /Beta/i.test(e.company)));
    const alphaCount = content.experiences.filter((e) => /Alpha/i.test(e.company)).length;
    assert.equal(alphaCount, 1);
  });
});

describe('Plan F — late headings after prose body', () => {
  it('rescues prose jobs that appear before Work Experience heading', () => {
    const content = parseExtractedResumeText(`
Late Heading Sample
late@mail.com | 8888888888 | Bengaluru, Karnataka

● Worked as Recruiter at First Co Consulting from Jan 2019 to Dec 2019
● Worked as Recruiter at Second Co Solutions from Jan 2020 to May 2021
● Working as Lead at Third Co Technologies from Jun 2021 to till date.

Languages known : English, Hindi

WORK EXPERIENCE
Additional notes about hiring.

EDUCATION
B.Com
City College
2018
`);
    assert.ok(content.experiences.length >= 3, `got ${content.experiences.length}`);
    assert.ok(content.education.length >= 1);
    assert.ok(content.languages.every((l) => !/cross|address/i.test(l)));
  });
});

describe('Bug 1 — Father s Name PDF apostrophe drop', () => {
  it('strips Father s Name (space instead of apostrophe) from skills', () => {
    const content = parseExtractedResumeText(`
Casey Sample
casey@mail.com | Jaipur, Rajasthan

SKILLS
Java, SQL, Father s Name: Parent Sample, AWS

WORK EXPERIENCE
Developer
Acme Labs
2022 - 2024
- Wrote services
`);
    assert.ok(content.skills.some((s) => /java/i.test(s)));
    assert.ok(content.skills.every((s) => !/father|parent sample/i.test(s)));
  });
});

describe('Bug 2 — bare Name label and year token in skills', () => {
  it('strips Name : value and bare 4-digit years from skills without changing fullName from them', () => {
    const content = parseExtractedResumeText(`
Header Person
header.person@mail.com | Pune, Maharashtra

SKILLS
Java, Name : Leaked.Token, 1988, SQL, AWS

WORK EXPERIENCE
Developer
Acme Labs
2022 - 2024
- Wrote services
`);
    assert.match(content.fullName, /Header Person/i);
    assert.doesNotMatch(content.fullName, /Leaked\.Token/i);
    assert.ok(content.skills.some((s) => /java/i.test(s)));
    assert.ok(content.skills.some((s) => /sql/i.test(s)));
    assert.ok(content.skills.every((s) => !/^name\s*:/i.test(s) && !/leaked\.token/i.test(s)));
    assert.ok(content.skills.every((s) => !/^(19|20)\d{2}$/.test(s)));
  });
});

describe('Bug 3 — capitalized PDF wrap continuation', () => {
  it('merges wrap bullets that start with capitalized tech tokens', () => {
    const content = parseExtractedResumeText(`
Wrap Sample
wrap@mail.com | Hyderabad, Telangana

WORK EXPERIENCE
Mobile Engineer
Phone Soft Pvt. Ltd.
Jan 2021 - Present
• Experience in developing applications using React
• Js, Android Development and related tooling for releases.
• Built release automation for the mobile pipeline.
`);
    const blobs = (content.experiences[0]?.responsibilities || []).join(' | ');
    assert.match(blobs, /React Js, Android Development/i);
    assert.ok(!blobs.split(' | ').some((b) => /^Js, Android/i.test(b.trim())));
    assert.match(blobs, /Built release automation/i);
  });
});

describe('Bug 4 — parseExperience fallback must not swallow later employers', () => {
  it('re-evaluates Job Profile employer boundaries after a weak first line', () => {
    const content = parseExtractedResumeText(`
Boundary Sample
boundary@mail.com | Chennai, Tamil Nadu

EXPERIENCE
• Odd preamble note without title structure
• Screening candidates for open roles
• Job Profile in First Consulting Services Pvt. Ltd.
• Oct 2020 - Apr 2022
• Sourced java profiles for clients
• Job Profile in Second Digital Marketing Pvt. Ltd.
• May 2022 - Present
• Led a small hiring pod
`);
    assert.ok(content.experiences.length >= 2, `got ${content.experiences.length}`);
    const blob = content.experiences.map((e) => `${e.jobTitle} ${e.company}`).join(' | ');
    assert.match(blob, /First Consulting/i);
    assert.match(blob, /Second Digital/i);
  });
});
