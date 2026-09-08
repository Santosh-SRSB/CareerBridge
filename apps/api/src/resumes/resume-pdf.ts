import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { CAREERBRIDGE_RESUME_TEMPLATE, type ResumeContent } from '@careerbridge/shared';

const NAVY = rgb(10 / 255, 46 / 255, 44 / 255);
const GOLD = rgb(202 / 255, 138 / 255, 4 / 255);
const MUTED = rgb(78 / 255, 104 / 255, 100 / 255);
const INK = rgb(0, 0, 0);
const PHOTO_W = 72;
const PHOTO_H = 88;

function winAnsi(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadPhotoBytes(photoUrl: string) {
  const dataUrl = photoUrl.match(/^data:image\/([a-zA-Z0-9+.-]+)(?:;[^,]*)?;base64,([\s\S]+)$/i);
  if (dataUrl) {
    return { mime: dataUrl[1].toLowerCase(), bytes: Buffer.from(dataUrl[2].replace(/\s+/g, ''), 'base64') };
  }
  if (/^https?:\/\//i.test(photoUrl)) {
    const response = await fetch(photoUrl);
    if (!response.ok) return null;
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    return { mime, bytes: Buffer.from(await response.arrayBuffer()) };
  }
  return null;
}

async function embedPhoto(doc: PDFDocument, photoUrl?: string | null) {
  if (!photoUrl) return null;
  const loaded = await loadPhotoBytes(photoUrl);
  if (!loaded) return null;
  const preferPng = loaded.mime.includes('png');
  const attempts = preferPng
    ? [() => doc.embedPng(loaded.bytes), () => doc.embedJpg(loaded.bytes)]
    : [() => doc.embedJpg(loaded.bytes), () => doc.embedPng(loaded.bytes)];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch {
      // try next
    }
  }
  return null;
}

/** CareerBridge master template PDF — matches on-screen resume-template-01. */
async function renderCareerBridgeTemplatePdf(content: ResumeContent) {
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

  const drawRow = (
    leftText: string,
    rightText: string,
    leftFont = bold,
    rightFont = italic,
    size = 10.5,
  ) => {
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

  drawCentered(content.fullName || 'Candidate', bold, 22);

  const contact = [content.city, content.email, content.phone].filter(Boolean).join('  |  ');
  if (contact) drawCentered(contact, regular, 9.5);
  y -= 4;

  if (content.summary) {
    section('Summary');
    drawLines(content.summary);
  }

  if (content.experiences?.length) {
    section('Experience');
    for (const item of content.experiences) {
      drawRow(item.jobTitle || 'Role', item.isInternship ? 'Internship' : '');
      if (item.company) {
        ensure(14);
        page.drawText(winAnsi(item.company), { x: left, y, size: 10, font: italic, color: INK });
        y -= 13;
      }
      if (item.description) {
        for (const bullet of item.description.split(/\n+/).map((b) => b.trim()).filter(Boolean)) {
          drawLines(`• ${bullet.replace(/^[-•*]\s*/, '')}`);
        }
      }
      y -= 2;
    }
  }

  if (content.skills?.length) {
    section('Technical Skills');
    drawLines(content.skills.join(', '));
  }

  if (content.education?.length) {
    section('Education');
    for (const edu of content.education) {
      const years = edu.yearCompleted ? String(edu.yearCompleted) : '';
      drawRow(edu.qualification || 'Education', years);
      if (edu.institution) {
        drawRow(edu.institution, '', italic, regular, 10);
      }
      y -= 2;
    }
  }

  if (content.projects?.length) {
    section('Projects');
    for (const proj of content.projects) {
      if (!proj.name?.trim()) continue;
      drawLines(proj.name, bold, 10.5);
      if (proj.description) {
        for (const line of proj.description.split(/\n+/).map((b) => b.trim()).filter(Boolean)) {
          drawLines(line.startsWith('•') ? line : `• ${line}`);
        }
      }
      y -= 2;
    }
  }

  if (content.certifications?.length) {
    section('Achievements and Certifications');
    for (const cert of content.certifications) {
      if (!cert?.trim()) continue;
      drawLines(`• ${cert}`);
    }
  }

  if (content.languages?.length) {
    section('Languages');
    drawLines(content.languages.join(', '));
  }

  return Buffer.from(await pdf.save());
}

export async function renderResumePdf(
  content: ResumeContent,
  template: string = CAREERBRIDGE_RESUME_TEMPLATE,
  photoUrl?: string | null,
) {
  const tid = (template || '').trim();
  if (!tid || tid === CAREERBRIDGE_RESUME_TEMPLATE || tid === 'master' || tid === 'CAREERBRIDGE') {
    return renderCareerBridgeTemplatePdf(content);
  }

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const photo = await embedPhoto(doc, photoUrl);
  const { width, height } = page.getSize();
  const left = 48;
  const right = width - 48;
  let y = height - 52;
  const accent =
    tid === 'MODERN' || tid === 'ats-modern'
      ? rgb(20 / 255, 184 / 255, 166 / 255)
      : tid === 'TECHNICAL'
        ? rgb(59 / 255, 130 / 255, 246 / 255)
        : tid.includes('minimal')
          ? rgb(71 / 255, 85 / 255, 105 / 255)
          : GOLD;
  const textRight = photo ? right - PHOTO_W - 16 : right;

  const wrap = (text: string, font: typeof regular, size: number, maxWidth: number) => {
    const words = winAnsi(text || '').split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  };

  let current = page;
  const ensure = (need: number) => {
    if (y - need < 48) {
      current = doc.addPage([595, 842]);
      y = height - 52;
    }
  };

  if (photo) {
    current.drawImage(photo, {
      x: right - PHOTO_W,
      y: y + 8 - PHOTO_H,
      width: PHOTO_W,
      height: PHOTO_H,
    });
  }

  current.drawRectangle({ x: left, y: y + 8, width: 72, height: 4, color: accent });
  y -= 18;
  current.drawText(winAnsi(content.fullName || 'Candidate'), {
    x: left,
    y,
    size: 22,
    font: bold,
    color: NAVY,
  });
  y -= 18;
  const meta = [content.city, content.phone].filter(Boolean).join('  |  ');
  if (meta) {
    current.drawText(winAnsi(meta), { x: left, y, size: 10, font: regular, color: MUTED });
    y -= 16;
  }
  if (photo) y = Math.min(y, height - 52 - PHOTO_H - 12);

  const section = (title: string) => {
    y -= 14;
    ensure(36);
    current.drawText(title.toUpperCase(), { x: left, y, size: 10, font: bold, color: NAVY });
    y -= 6;
    current.drawLine({
      start: { x: left, y },
      end: { x: right, y },
      thickness: 0.8,
      color: rgb(0.85, 0.9, 0.89),
    });
    y -= 14;
  };

  const para = (text: string, font = regular, size = 10) => {
    const lines = wrap(text, font, size, textRight - left);
    for (const line of lines) {
      ensure(16);
      current.drawText(line, { x: left, y, size, font, color: INK });
      y -= 13;
    }
  };

  if (content.summary) {
    section('Summary');
    para(content.summary);
  }

  if (content.skills.length) {
    section('Skills');
    para(content.skills.join('  ·  '));
  }

  if (content.experiences.length) {
    section('Experience');
    for (const item of content.experiences) {
      ensure(40);
      current.drawText(winAnsi(item.jobTitle || 'Role'), { x: left, y, size: 11, font: bold, color: NAVY });
      y -= 14;
      current.drawText(
        winAnsi(`${item.company}${item.isInternship ? '  ·  Internship' : ''}`),
        { x: left, y, size: 10, font: regular, color: MUTED },
      );
      y -= 14;
      if (item.description) para(item.description);
      y -= 6;
    }
  }

  if (content.education.length) {
    section('Education');
    for (const item of content.education) {
      para(
        [item.qualification, item.institution, item.yearCompleted ? String(item.yearCompleted) : '']
          .filter(Boolean)
          .join('  ·  '),
        bold,
        10,
      );
    }
  }

  if (content.projects?.length) {
    section('Projects');
    for (const item of content.projects) {
      para(item.name, bold, 10);
      if (item.description) para(item.description);
    }
  }

  if (content.certifications?.length) {
    section('Certifications');
    para(content.certifications.join('  ·  '));
  }

  if (content.languages.length) {
    section('Languages');
    para(content.languages.join('  ·  '));
  }

  return Buffer.from(await doc.save());
}
