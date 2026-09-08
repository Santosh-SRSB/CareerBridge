import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { savePdfBytes } from '@/lib/resume-pdf';

const INK = rgb(0, 0, 0);

function winAnsi(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function dateRange(start: string, end: string, isCurrent: boolean) {
  const parts: string[] = [];
  if (start) parts.push(start);
  if (isCurrent) parts.push('Present');
  else if (end) parts.push(end);
  return parts.join(' – ');
}

function educationDegreeLine(degree: string, field: string) {
  if (degree && field) return `${degree} in ${field}`;
  return degree || field;
}

export async function renderMasterResumePdf(doc: MasterResumeDocument) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const pageWidth = 595;
  const pageHeight = 842;
  let page = pdf.addPage([pageWidth, pageHeight]);
  const left = 52;
  const right = pageWidth - 52;
  let y = pageHeight - 56;

  const wrap = (text: string, font: typeof regular, size: number, maxWidth: number) => {
    const words = winAnsi(text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  const ensure = (need: number) => {
    if (y - need < 52) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
    }
  };

  const drawLines = (text: string, font = regular, size = 10.5) => {
    for (const line of wrap(text, font, size, right - left)) {
      ensure(14);
      page.drawText(line, { x: left, y, size, font, color: INK });
      y -= 13;
    }
  };

  const drawCentered = (text: string, font: typeof regular, size: number) => {
    const t = winAnsi(text);
    const w = font.widthOfTextAtSize(t, size);
    ensure(16);
    page.drawText(t, { x: (pageWidth - w) / 2, y, size, font, color: INK });
    y -= size + 4;
  };

  const section = (title: string) => {
    y -= 10;
    ensure(24);
    page.drawText(title.toUpperCase(), { x: left, y, size: 10, font: bold, color: INK });
    y -= 4;
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.75, color: INK });
    y -= 10;
  };

  const drawRow = (leftText: string, rightText: string, leftFont = bold, rightFont = italic, size = 10.5) => {
    ensure(14);
    const lt = winAnsi(leftText);
    const rt = winAnsi(rightText);
    page.drawText(lt, { x: left, y, size, font: leftFont, color: INK });
    if (rt) {
      const rw = rightFont.widthOfTextAtSize(rt, size);
      page.drawText(rt, { x: right - rw, y, size, font: rightFont, color: INK });
    }
    y -= 13;
  };

  const { personalInfo } = doc;
  drawCentered(personalInfo.fullName || 'Candidate', bold, 22);

  const contact = [personalInfo.location, personalInfo.email, personalInfo.phone, personalInfo.linkedin]
    .filter(Boolean)
    .join('  |  ');
  if (contact) drawCentered(contact, regular, 9.5);

  y -= 4;

  if (doc.summary) {
    section('Summary');
    drawLines(doc.summary);
  }

  if (doc.experience.length) {
    section('Experience');
    for (const item of doc.experience) {
      const dates = dateRange(item.startDate, item.endDate, item.isCurrent);
      drawRow(item.jobTitle || 'Role', dates);
      const companyLine = [item.company, item.location].filter(Boolean).join(', ');
      if (companyLine) {
        ensure(14);
        page.drawText(winAnsi(companyLine), { x: left, y, size: 10, font: italic, color: INK });
        y -= 13;
      }
      for (const bullet of item.responsibilities) {
        drawLines(`• ${bullet}`);
      }
      y -= 2;
    }
  }

  const skillGroups = doc.technicalSkills.filter((g) => g.skills.length);
  if (skillGroups.length) {
    section('Technical Skills');
    for (const group of skillGroups) {
      const line = group.category
        ? `${group.category}: ${group.skills.join(', ')}`
        : group.skills.join(', ');
      drawLines(`• ${line}`, regular, 10.5);
    }
  }

  if (doc.education.length) {
    section('Education');
    for (const edu of doc.education) {
      const heading = educationDegreeLine(edu.degree, edu.field);
      const years = [edu.startYear, edu.endYear].filter(Boolean).join(' – ');
      drawRow(heading, years);
      const place = [edu.institution, edu.location].filter(Boolean).join(', ');
      const grade = edu.gradeType && edu.grade ? `${edu.gradeType}: ${edu.grade}` : edu.grade;
      if (place || grade) {
        drawRow(place, grade, italic, regular, 10);
      }
      y -= 2;
    }
  }

  if (doc.projects.length) {
    section('Projects');
    for (const proj of doc.projects) {
      const tech = proj.technologies.length ? ` | ${proj.technologies.join(', ')}` : '';
      drawLines(`${proj.name}${tech}`, bold, 10.5);
      if (proj.description) drawLines(proj.description);
      for (const bullet of proj.bullets) {
        drawLines(`• ${bullet}`);
      }
      y -= 2;
    }
  }

  const hasAchievements = doc.achievements.some((a) => a.title || a.description);
  const hasCerts = doc.certifications.some((c) => c.name);
  if (hasAchievements || hasCerts) {
    section('Achievements and Certifications');
    for (const ach of doc.achievements) {
      if (!ach.title && !ach.description) continue;
      const line = [ach.title, ach.organization, ach.description].filter(Boolean).join(' — ');
      drawRow(`• ${line}`, ach.date, regular, italic, 10);
    }
    for (const cert of doc.certifications) {
      if (!cert.name) continue;
      const line = [cert.name, cert.issuer].filter(Boolean).join(' — ');
      drawRow(`• ${line}`, cert.date, regular, italic, 10);
    }
  }

  return pdf.save();
}

export async function downloadMasterResumePdf(doc: MasterResumeDocument, fileName?: string) {
  const bytes = await renderMasterResumePdf(doc);
  savePdfBytes(bytes, fileName || `${doc.personalInfo.fullName.replace(/\s+/g, '-')}-Resume.pdf`);
}
