/**
 * PDF download for CareerBridge master resume (resume-template-01 layout).
 *
 * Real pdf-lib text (pdf-parse friendly) + URI link annotations for LinkedIn/GitHub.
 * Intelligent one-page density fitting — never truncates candidate content.
 * Preview UI is unchanged.
 */
import { PDFDocument, PDFString, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  contactNodes,
  dateRange,
  projectBulletTexts,
  projectTechnologies,
  visibleBullets,
} from '@/components/resume-templates/helpers.js';
import { masterResumeToAtsData } from '@/features/resume/master-to-ats-data';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { savePdfBytes } from '@/lib/resume-pdf';

const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;
const INK = rgb(0, 0, 0);

type PdfDensity = {
  name: string;
  sideMargin: number;
  topMargin: number;
  bottomMargin: number;
  nameSize: number;
  contactSize: number;
  bodySize: number;
  sectionSize: number;
  companySize: number;
  /** Vertical advance after a body line (includes line height feel). */
  lineAdvance: number;
  sectionBefore: number;
  sectionAfterTitle: number;
  sectionRuleGap: number;
  entryGap: number;
  headerAfterName: number;
  headerAfterContact: number;
};

/** Prefer looser spacing when short; tighten only when needed to keep one page. */
const DENSITY_PROFILES: PdfDensity[] = [
  {
    name: 'expanded',
    sideMargin: 52,
    topMargin: 52,
    bottomMargin: 48,
    nameSize: 22,
    contactSize: 9.5,
    bodySize: 10.5,
    sectionSize: 10,
    companySize: 10,
    lineAdvance: 14.5,
    sectionBefore: 14,
    sectionAfterTitle: 5,
    sectionRuleGap: 12,
    entryGap: 6,
    headerAfterName: 6,
    headerAfterContact: 10,
  },
  {
    name: 'relaxed',
    sideMargin: 52,
    topMargin: 50,
    bottomMargin: 46,
    nameSize: 22,
    contactSize: 9.5,
    bodySize: 10.5,
    sectionSize: 10,
    companySize: 10,
    lineAdvance: 13.5,
    sectionBefore: 12,
    sectionAfterTitle: 4,
    sectionRuleGap: 11,
    entryGap: 4,
    headerAfterName: 5,
    headerAfterContact: 8,
  },
  {
    name: 'normal',
    sideMargin: 50,
    topMargin: 48,
    bottomMargin: 44,
    nameSize: 21,
    contactSize: 9.25,
    bodySize: 10.25,
    sectionSize: 10,
    companySize: 9.75,
    lineAdvance: 13,
    sectionBefore: 10,
    sectionAfterTitle: 4,
    sectionRuleGap: 10,
    entryGap: 3,
    headerAfterName: 4,
    headerAfterContact: 6,
  },
  {
    name: 'compact',
    sideMargin: 46,
    topMargin: 42,
    bottomMargin: 40,
    nameSize: 20,
    contactSize: 9,
    bodySize: 9.75,
    sectionSize: 9.5,
    companySize: 9.5,
    lineAdvance: 12.2,
    sectionBefore: 8,
    sectionAfterTitle: 3,
    sectionRuleGap: 8,
    entryGap: 2,
    headerAfterName: 3,
    headerAfterContact: 5,
  },
  {
    name: 'tight',
    sideMargin: 42,
    topMargin: 38,
    bottomMargin: 36,
    nameSize: 19,
    contactSize: 8.75,
    bodySize: 9.25,
    sectionSize: 9,
    companySize: 9,
    lineAdvance: 11.4,
    sectionBefore: 6,
    sectionAfterTitle: 3,
    sectionRuleGap: 7,
    entryGap: 2,
    headerAfterName: 3,
    headerAfterContact: 4,
  },
  {
    name: 'min',
    sideMargin: 38,
    topMargin: 34,
    bottomMargin: 32,
    nameSize: 18,
    contactSize: 8.5,
    bodySize: 8.75,
    sectionSize: 8.75,
    companySize: 8.5,
    lineAdvance: 10.6,
    sectionBefore: 5,
    sectionAfterTitle: 2.5,
    sectionRuleGap: 6,
    entryGap: 1.5,
    headerAfterName: 2,
    headerAfterContact: 3,
  },
];

type AtsData = ReturnType<typeof masterResumeToAtsData>;

type LinkHit = {
  pageIndex: number;
  uri: string;
  rect: [number, number, number, number];
};

function winAnsi(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Times-Roman can draw U+2022; do NOT run it through winAnsi (that strips it to a space). */
const PDF_BULLET = '\u2022';

/** Strip leading bullet markers only; keep the candidate's text unchanged. */
function stripLeadingBulletMarker(raw: string): string {
  return String(raw || '')
    .replace(/^\s*[-•\*·▪◦]+\s*/, '')
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
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
}

function normalizePdfHref(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^(javascript|data|vbscript):/i.test(value)) return null;
  if (/^mailto:/i.test(value) || /^tel:/i.test(value)) return value;
  let candidate = value;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/\//, '')}`;
  }
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function addPdfUriLink(page: PDFPage, uri: string, rect: [number, number, number, number]) {
  const [x1, y1, x2, y2] = rect;
  if (!(x2 > x1) || !(y2 > y1)) return;
  const annotRef = page.doc.context.register(
    page.doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x1, y1, x2, y2],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(uri),
      },
    }),
  );
  page.node.addAnnot(annotRef);
}

type Fonts = { regular: PDFFont; bold: PDFFont; italic: PDFFont };

/**
 * Measure or draw the full resume with a density profile.
 * When `draw` is false, only height / page count are computed (no PDF mutations).
 */
function layoutResume(
  data: AtsData,
  fonts: Fonts,
  density: PdfDensity,
  options: {
    draw: boolean;
    pdf?: PDFDocument;
    startPage?: PDFPage;
  },
): { heightUsed: number; pageCount: number; fitsOnePage: boolean; links: LinkHit[] } {
  const { regular, bold, italic } = fonts;
  const left = density.sideMargin;
  const right = PDF_WIDTH - density.sideMargin;
  const contentWidth = right - left;
  const usable = PDF_HEIGHT - density.topMargin - density.bottomMargin;

  let page = options.startPage;
  let pageIndex = 0;
  let y = PDF_HEIGHT - density.topMargin;
  let pageCount = 1;
  const links: LinkHit[] = [];

  const ensure = (need: number) => {
    if (y - need >= density.bottomMargin) return;
    if (options.draw && options.pdf) {
      page = options.pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);
      pageIndex += 1;
      pageCount += 1;
      y = PDF_HEIGHT - density.topMargin;
    } else {
      // Measure mode: continue on a virtual next page.
      pageCount += 1;
      pageIndex += 1;
      y = PDF_HEIGHT - density.topMargin;
    }
  };

  const advance = (amount: number) => {
    y -= amount;
  };

  const drawText = (text: string, x: number, size: number, font: PDFFont) => {
    if (!options.draw || !page) return;
    page.drawText(text, { x, y, size, font, color: INK });
  };

  const drawLineRule = () => {
    if (!options.draw || !page) return;
    page.drawLine({
      start: { x: left, y },
      end: { x: right, y },
      thickness: 0.75,
      color: INK,
    });
  };

  const drawCentered = (text: string, font: PDFFont, size: number) => {
    const t = winAnsi(text);
    if (!t) return;
    const w = font.widthOfTextAtSize(t, size);
    ensure(size + 4);
    drawText(t, (PDF_WIDTH - w) / 2, size, font);
    advance(size + density.headerAfterName * 0.35);
  };

  const drawLines = (text: string, font: PDFFont = regular, size = density.bodySize) => {
    for (const line of wrapText(text, font, size, contentWidth)) {
      ensure(density.lineAdvance);
      drawText(line, left, size, font);
      advance(density.lineAdvance);
    }
  };

  /**
   * Draw one experience/project bullet with a visible • marker.
   * Bullet glyph is drawn outside winAnsi (which would strip U+2022 to a space).
   * Continuation lines use a hanging indent under the text.
   */
  const drawBullet = (raw: string, font: PDFFont = regular, size = density.bodySize) => {
    const body = winAnsi(stripLeadingBulletMarker(raw));
    if (!body) return;
    const marker = `${PDF_BULLET} `;
    const markerWidth = font.widthOfTextAtSize(marker, size);
    const words = body.split(/\s+/).filter(Boolean);
    let line = '';
    let first = true;
    const flush = () => {
      if (!line && !first) return;
      ensure(density.lineAdvance);
      if (first) {
        drawText(marker, left, size, font);
        if (line) drawText(line, left + markerWidth, size, font);
        first = false;
      } else {
        drawText(line, left + markerWidth, size, font);
      }
      advance(density.lineAdvance);
      line = '';
    };
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      const max = first ? Math.max(24, contentWidth - markerWidth) : Math.max(24, contentWidth - markerWidth);
      if (font.widthOfTextAtSize(next, size) <= max) line = next;
      else {
        flush();
        line = word;
      }
    }
    flush();
  };

  const section = (title: string) => {
    advance(density.sectionBefore);
    ensure(density.sectionSize + density.sectionAfterTitle + density.sectionRuleGap + 4);
    drawText(winAnsi(title.toUpperCase()), left, density.sectionSize, bold);
    advance(density.sectionAfterTitle);
    drawLineRule();
    advance(density.sectionRuleGap);
  };

  const drawRow = (
    leftText: string,
    rightText: string,
    leftFont: PDFFont = bold,
    rightFont: PDFFont = italic,
    size = density.bodySize,
  ) => {
    ensure(density.lineAdvance);
    const lt = winAnsi(leftText);
    const rt = winAnsi(rightText);
    // Keep room for dates on the right.
    const dateW = rt ? rightFont.widthOfTextAtSize(rt, size) + 8 : 0;
    const maxLeft = Math.max(40, contentWidth - dateW);
    const leftLines = wrapText(lt, leftFont, size, maxLeft);
    leftLines.forEach((line, i) => {
      if (i > 0) ensure(density.lineAdvance);
      drawText(line, left, size, leftFont);
      if (i === 0 && rt) {
        const rw = rightFont.widthOfTextAtSize(rt, size);
        drawText(rt, right - rw, size, rightFont);
      }
      if (i < leftLines.length - 1) advance(density.lineAdvance);
    });
    advance(density.lineAdvance);
  };

  // —— Header ——
  drawCentered(data.fullName || 'Your Name', bold, density.nameSize);
  advance(density.headerAfterName);

  const nodes = contactNodes(data, ' | ');
  if (nodes.length) {
    const size = density.contactSize;
    const parts = nodes.map((node: { label: string; href?: string; separator?: string }) => {
      const label = winAnsi(node.label);
      const sep = node.separator || '';
      return {
        label,
        sep,
        href: node.href ? normalizePdfHref(node.href) : null,
        labelWidth: regular.widthOfTextAtSize(label, size),
        sepWidth: sep ? regular.widthOfTextAtSize(sep, size) : 0,
      };
    });
    const totalWidth = parts.reduce((sum, p) => sum + p.labelWidth + p.sepWidth, 0);
    ensure(density.lineAdvance);
    if (totalWidth <= contentWidth) {
      let x = (PDF_WIDTH - totalWidth) / 2;
      for (const part of parts) {
        drawText(part.label, x, size, regular);
        if (part.href && options.draw) {
          links.push({
            pageIndex,
            uri: part.href,
            rect: [x, y - 2, x + part.labelWidth, y + size],
          });
        }
        x += part.labelWidth;
        if (part.sep) {
          drawText(part.sep, x, size, regular);
          x += part.sepWidth;
        }
      }
      advance(density.lineAdvance);
    } else {
      // Wrap contact onto multiple centered-ish lines without dropping items.
      let x = left;
      let lineStart = true;
      for (const part of parts) {
        const pieceW = part.labelWidth + part.sepWidth;
        if (!lineStart && x + pieceW > right) {
          advance(density.lineAdvance);
          ensure(density.lineAdvance);
          x = left;
          lineStart = true;
        }
        drawText(part.label, x, size, regular);
        if (part.href && options.draw) {
          links.push({
            pageIndex,
            uri: part.href,
            rect: [x, y - 2, x + part.labelWidth, y + size],
          });
        }
        x += part.labelWidth;
        if (part.sep) {
          drawText(part.sep, x, size, regular);
          x += part.sepWidth;
        }
        lineStart = false;
      }
      advance(density.lineAdvance);
    }
  }
  advance(density.headerAfterContact);

  // —— Summary ——
  if (data.summary?.trim()) {
    section('Summary');
    drawLines(data.summary);
  }

  // —— Experience ——
  if (Array.isArray(data.experience) && data.experience.length) {
    section('Experience');
    for (const job of data.experience) {
      const dates = dateRange(job.startDate, job.endDate, job.current);
      drawRow(String(job.role || 'Role').trim() || 'Role', dates || '');
      const companyLine = [job.company, job.location].filter(Boolean).join(', ');
      if (companyLine) {
        ensure(density.lineAdvance);
        drawText(winAnsi(companyLine), left, density.companySize, italic);
        advance(density.lineAdvance);
      }
      for (const bullet of visibleBullets(job.bullets)) {
        drawBullet(String(bullet));
      }
      advance(density.entryGap);
    }
  }

  // —— Technical Skills ——
  const skillGroups =
    Array.isArray(data.technicalSkills) &&
    data.technicalSkills.some((g: { skills?: string[] }) => g?.skills?.length)
      ? data.technicalSkills.filter(
          (g: { category?: string; skills?: string[] }) => g.category || (g.skills && g.skills.length),
        )
      : Array.isArray(data.skills) && data.skills.length
        ? [{ category: '', skills: data.skills }]
        : [];
  if (skillGroups.length) {
    section('Technical Skills');
    for (const group of skillGroups) {
      const skills = (group.skills || []).filter(Boolean).join(', ');
      if (!skills && !group.category) continue;
      if (group.category) {
        const cat = winAnsi(`${group.category}: `);
        const skillText = winAnsi(skills);
        const words = skillText.split(/\s+/).filter(Boolean);
        let line = '';
        let first = true;
        const emit = (text: string, withCategory: boolean) => {
          ensure(density.lineAdvance);
          if (withCategory) {
            drawText(cat, left, density.bodySize, bold);
            const cw = bold.widthOfTextAtSize(cat, density.bodySize);
            if (text) drawText(text, left + cw, density.bodySize, regular);
          } else {
            drawText(text, left, density.bodySize, regular);
          }
          advance(density.lineAdvance);
        };
        if (!words.length) {
          emit('', true);
        } else {
          for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            const max = first
              ? Math.max(20, contentWidth - bold.widthOfTextAtSize(cat, density.bodySize))
              : contentWidth;
            if (regular.widthOfTextAtSize(next, density.bodySize) <= max) {
              line = next;
            } else {
              emit(line, first);
              first = false;
              line = word;
            }
          }
          if (line || first) emit(line, first);
        }
      } else {
        drawLines(skills);
      }
    }
  }

  // —— Education ——
  if (Array.isArray(data.education) && data.education.length) {
    section('Education');
    for (const ed of data.education) {
      const degree = ed.degree || '';
      const field = ed.fieldOfStudy || ed.field || '';
      const heading =
        degree && field ? `${degree} in ${field}` : degree || field || ed.level || 'Education';
      const years = dateRange(ed.startDate, ed.endDate, false);
      drawRow(heading, years || '');
      const place = [ed.institution || ed.school, ed.location].filter(Boolean).join(', ');
      const grade = ed.grade || ed.gpa || '';
      if (place || grade) {
        ensure(density.lineAdvance);
        if (place) drawText(winAnsi(place), left, density.companySize, italic);
        if (grade) {
          const g = winAnsi(grade);
          const gw = regular.widthOfTextAtSize(g, density.companySize);
          drawText(g, right - gw, density.companySize, regular);
        }
        advance(density.lineAdvance);
      }
      advance(density.entryGap);
    }
  }

  // —— Projects ——
  if (Array.isArray(data.projects) && data.projects.length) {
    const projects = data.projects.filter((p: Record<string, unknown>) => {
      const bullets = projectBulletTexts(p);
      const techs = projectTechnologies(p);
      return p.name || p.title || p.description || bullets.length || techs.length;
    });
    if (projects.length) {
      section('Projects');
      for (const p of projects) {
        const bullets = projectBulletTexts(p);
        const techs = projectTechnologies(p);
        const title = String(p.name || p.title || '').trim();
        let overview = String(p.description || '').trim();
        if (techs.length && overview) {
          overview = overview
            .replace(
              /(?:^|\n)\s*(?:technologies?|tech\s*stack|tools?(?:\s+used)?|stack)\s*[:|\-–—]\s*.+$/gim,
              '',
            )
            .trim();
        }
        if (title) {
          ensure(density.lineAdvance);
          const boldPart = winAnsi(title);
          const projectUrl = normalizePdfHref(String(p.url || p.link || ''));
          const titleY = y;
          drawText(boldPart, left, density.bodySize, bold);
          const bw = bold.widthOfTextAtSize(boldPart, density.bodySize);
          if (techs.length) {
            const rest = winAnsi(` | ${techs.join(', ')}`);
            if (bw + italic.widthOfTextAtSize(rest, density.bodySize) <= contentWidth) {
              drawText(rest, left + bw, density.bodySize, italic);
            } else {
              advance(density.lineAdvance);
              drawLines(`Technologies: ${techs.join(', ')}`, italic, density.companySize);
            }
          }
          if (projectUrl && options.draw) {
            links.push({
              pageIndex,
              uri: projectUrl,
              rect: [left, titleY - 2, left + bw, titleY + density.bodySize],
            });
          }
          advance(density.lineAdvance);
        }
        if (overview) drawLines(overview);
        for (const bullet of bullets) {
          drawBullet(String(bullet));
        }
        advance(density.entryGap);
      }
    }
  }

  // —— Achievements ——
  const achievements = (data.achievements || []).filter(
    (a: { title?: string; organization?: string; description?: string }) => {
      const text = [a.title, a.organization, a.description].filter(Boolean).join(' — ');
      return Boolean(text.trim());
    },
  );
  if (achievements.length) {
    section('Achievements');
    for (const a of achievements) {
      const text = [a.title, a.organization, a.description].filter(Boolean).join(' — ');
      const dates = a.date || '';
      // Bullet + hanging text; date on the first line when present.
      const body = winAnsi(stripLeadingBulletMarker(text));
      if (!body) continue;
      const marker = `${PDF_BULLET} `;
      const markerWidth = regular.widthOfTextAtSize(marker, density.bodySize);
      const dateStr = winAnsi(dates);
      const dateW = dateStr ? italic.widthOfTextAtSize(dateStr, density.bodySize) + 8 : 0;
      const maxFirst = Math.max(24, contentWidth - markerWidth - dateW);
      const words = body.split(/\s+/).filter(Boolean);
      let line = '';
      let first = true;
      const flush = () => {
        if (!line && !first) return;
        ensure(density.lineAdvance);
        if (first) {
          drawText(marker, left, density.bodySize, regular);
          if (line) drawText(line, left + markerWidth, density.bodySize, regular);
          if (dateStr) {
            const rw = italic.widthOfTextAtSize(dateStr, density.bodySize);
            drawText(dateStr, right - rw, density.bodySize, italic);
          }
          first = false;
        } else {
          drawText(line, left + markerWidth, density.bodySize, regular);
        }
        advance(density.lineAdvance);
        line = '';
      };
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        const max = first ? maxFirst : Math.max(24, contentWidth - markerWidth);
        if (regular.widthOfTextAtSize(next, density.bodySize) <= max) line = next;
        else {
          flush();
          line = word;
        }
      }
      flush();
    }
  }

  // —— Certifications ——
  const certs = (data.certifications || [])
    .map((c: string | { name?: string; issuer?: string; date?: string; url?: string }) =>
      typeof c === 'string' ? { name: c, issuer: '', date: '', url: '' } : c,
    )
    .filter((c: { name?: string; issuer?: string }) => c.name || c.issuer);
  if (certs.length) {
    section('Certifications');
    for (const c of certs) {
      const name = String(c.name || '').trim();
      const issuer = String(c.issuer || '').trim();
      const date = String(c.date || '').trim();
      let text = name;
      if (name && issuer && date) text = `${name} — ${issuer} (${date})`;
      else if (name && issuer) text = `${name} — ${issuer}`;
      else if (name && date) text = `${name} (${date})`;
      else if (issuer && date) text = `${issuer} (${date})`;
      else text = name || issuer;
      if (!text) continue;
      const linkY = y;
      drawBullet(text);
      const certUrl = normalizePdfHref(String(c.url || ''));
      if (certUrl && options.draw) {
        const markerW = regular.widthOfTextAtSize(`${PDF_BULLET} `, density.bodySize);
        const sample = winAnsi(stripLeadingBulletMarker(text)).slice(0, 40);
        const w = Math.min(contentWidth, markerW + regular.widthOfTextAtSize(sample, density.bodySize));
        links.push({
          pageIndex,
          uri: certUrl,
          rect: [left, y, left + Math.max(w, 24), linkY + density.bodySize],
        });
      }
    }
  }

  // —— Languages ——
  const languages = (data.languages || [])
    .map(
      (lang: string | { name?: string; language?: string; level?: string; proficiency?: string; description?: string }) => {
        if (typeof lang === 'string') return lang.trim();
        const name = lang.name || lang.language || '';
        const level = lang.level || lang.proficiency || lang.description || '';
        return level ? `${name} — ${level}` : name;
      },
    )
    .filter(Boolean);
  if (languages.length) {
    section('Languages');
    drawLines(languages.join('  ·  '));
  }

  const heightUsed =
    pageCount === 1 ? PDF_HEIGHT - density.topMargin - y : pageCount * usable;
  const fitsOnePage = pageCount === 1 && y >= density.bottomMargin - 0.5;

  return { heightUsed, pageCount, fitsOnePage, links };
}

function pickDensity(data: AtsData, fonts: Fonts): PdfDensity {
  // Prefer the loosest profile that still fits on one page (expanded → min).
  for (const profile of DENSITY_PROFILES) {
    const result = layoutResume(data, fonts, profile, { draw: false });
    if (result.fitsOnePage) return profile;
  }
  // Content genuinely cannot fit one page at min readable size — keep all info, allow multi-page.
  return DENSITY_PROFILES[DENSITY_PROFILES.length - 1];
}

/**
 * Render master resume as a real-text A4 PDF with intelligent one-page fitting.
 */
export async function renderMasterResumePdf(doc: MasterResumeDocument): Promise<Uint8Array> {
  const data = masterResumeToAtsData(doc);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const fonts = { regular, bold, italic };

  const density = pickDensity(data, fonts);
  const page = pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);
  const { links } = layoutResume(data, fonts, density, { draw: true, pdf, startPage: page });

  const pages = pdf.getPages();
  for (const hit of links) {
    const target = pages[hit.pageIndex];
    if (target) addPdfUriLink(target, hit.uri, hit.rect);
  }

  return pdf.save();
}

export async function downloadMasterResumePdf(doc: MasterResumeDocument, fileName?: string) {
  const bytes = await renderMasterResumePdf(doc);
  savePdfBytes(
    bytes,
    fileName || `${(doc.personalInfo.fullName || 'Resume').replace(/\s+/g, '-')}-Resume.pdf`,
  );
}
