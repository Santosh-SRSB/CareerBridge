/**
 * PDF download from the SAME resume preview template DOM/CSS (resume-template-01).
 * Preview is the source of truth — do not recreate a separate pdf-lib layout.
 *
 * PDF-only overrides (clone capture): Times-Roman / Times-Bold / Times-Italic
 * and bullet+text alignment fixes for html2canvas (does not change on-screen preview).
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { PDFDocument, PDFString, type PDFPage } from 'pdf-lib';
import html2canvas from 'html2canvas';
import { getTemplateComponent } from '@/components/resume-templates/index.js';
import { DENSITY_LEVELS, pickDensityLevel, RESUME_PAGE } from '@/components/resume-templates/pageFit.js';
import '@/components/resume-templates/resume-template-01.css';
import { masterResumeToAtsData } from '@/features/resume/master-to-ats-data';
import type { MasterResumeDocument } from '@/features/resume/master-resume.types';
import { savePdfBytes } from '@/lib/resume-pdf';

/** A4 at 96dpi — matches existing preview sheet sizing used across templates. */
const PAGE_WIDTH_PX = RESUME_PAGE.width;
const PAGE_HEIGHT_PX = RESUME_PAGE.height;
/** A4 in PDF points */
const PDF_WIDTH = 595.28;
const PDF_HEIGHT = 841.89;

/** PDF-only font stack matching Times-Roman / Times-Bold / Times-Italic. */
const PDF_TIMES_STACK = '"Times New Roman", Times, "Times-Roman", serif';

const PDF_CAPTURE_STYLE_ID = 'cb-resume-pdf-capture-fonts';

type ResumeLinkBox = {
  href: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

function waitFrames(count = 2) {
  return new Promise<void>((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(count);
  });
}

/** Normalize profile/contact URLs for PDF URI annotations (https when protocol missing). */
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

/**
 * Measure clickable resume links from the html2canvas clone (after PDF-only styles),
 * so annotation rects match the rasterized image.
 */
function collectResumeLinkBoxes(clonedDoc: Document): ResumeLinkBox[] {
  const root = clonedDoc.querySelector('[data-resume-pdf-capture="1"]') as HTMLElement | null;
  if (!root) return [];
  const sheet = (root.querySelector('.preview-sheet') as HTMLElement | null) || root;
  const origin = sheet.getBoundingClientRect();
  const boxes: ResumeLinkBox[] = [];
  sheet.querySelectorAll('a.resume-link[href]').forEach((node) => {
    const el = node as HTMLAnchorElement;
    const href = normalizePdfHref(el.getAttribute('href') || el.href || '');
    if (!href) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    boxes.push({
      href,
      x: rect.left - origin.left,
      y: rect.top - origin.top,
      w: rect.width,
      h: rect.height,
    });
  });
  return boxes;
}

/** Attach a real PDF Link annotation (URI action) over existing visible text. */
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

/**
 * Map DOM link boxes (CSS px on the A4 sheet) onto a rasterized PDF page slice.
 */
function addLinksForPage(
  page: PDFPage,
  links: ResumeLinkBox[],
  pageIndex: number,
  pageHeightPx: number,
  pageWidthPx: number,
  drawWidth: number,
  drawHeight: number,
  sliceHeightPx: number,
) {
  const pageTop = pageIndex * pageHeightPx;
  const pageBottom = pageTop + sliceHeightPx;
  for (const link of links) {
    const linkBottom = link.y + link.h;
    if (linkBottom <= pageTop || link.y >= pageBottom) continue;

    const topOnPage = Math.max(link.y, pageTop) - pageTop;
    const bottomOnPage = Math.min(linkBottom, pageBottom) - pageTop;
    if (bottomOnPage - topOnPage < 0.5) continue;

    const x1 = (link.x / pageWidthPx) * drawWidth;
    const x2 = ((link.x + link.w) / pageWidthPx) * drawWidth;
    // PDF y origin is bottom-left; image is top-aligned on the page.
    const y2 = PDF_HEIGHT - (topOnPage / sliceHeightPx) * drawHeight;
    const y1 = PDF_HEIGHT - (bottomOnPage / sliceHeightPx) * drawHeight;
    addPdfUriLink(page, link.href, [x1, y1, x2, y2]);
  }
}

async function waitForFonts() {
  try {
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      await document.fonts.ready;
    }
  } catch {
    /* ignore */
  }
}

/**
 * Apply PDF-only Times fonts + bullet alignment on the html2canvas clone.
 * Does not touch the live preview DOM.
 */
function preparePdfCaptureClone(clonedDoc: Document) {
  const clonedHost = clonedDoc.querySelector('[data-resume-pdf-capture="1"]') as HTMLElement | null;
  if (clonedHost) {
    clonedHost.style.left = '0';
    clonedHost.style.position = 'absolute';
    clonedHost.style.zIndex = '0';
  }

  if (!clonedDoc.getElementById(PDF_CAPTURE_STYLE_ID)) {
    const style = clonedDoc.createElement('style');
    style.id = PDF_CAPTURE_STYLE_ID;
    style.textContent = `
      [data-resume-pdf-capture="1"],
      [data-resume-pdf-capture="1"] * {
        font-family: ${PDF_TIMES_STACK} !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01,
      [data-resume-pdf-capture="1"] .resume-template-01 p,
      [data-resume-pdf-capture="1"] .resume-template-01 li,
      [data-resume-pdf-capture="1"] .resume-template-01 span,
      [data-resume-pdf-capture="1"] .resume-template-01 .rt01-contact,
      [data-resume-pdf-capture="1"] .resume-template-01 .rt01-summary {
        font-family: ${PDF_TIMES_STACK} !important;
        font-weight: 400 !important;
        font-style: normal !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 h1,
      [data-resume-pdf-capture="1"] .resume-template-01 h2,
      [data-resume-pdf-capture="1"] .resume-template-01 strong,
      [data-resume-pdf-capture="1"] .resume-template-01 b,
      [data-resume-pdf-capture="1"] .resume-template-01 .rt01-role {
        font-family: ${PDF_TIMES_STACK} !important;
        font-weight: 700 !important;
        font-style: normal !important;
      }
      /* Match View Resume spacing under section heading + divider */
      [data-resume-pdf-capture="1"] .resume-template-01 h2 {
        margin: 0 0 12px !important;
        padding-bottom: 4px !important;
        border-bottom: 1px solid #000 !important;
        line-height: 1.35 !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 section > p:first-of-type,
      [data-resume-pdf-capture="1"] .resume-template-01 section > ul:first-of-type,
      [data-resume-pdf-capture="1"] .resume-template-01 section > .rt01-entry:first-of-type,
      [data-resume-pdf-capture="1"] .resume-template-01 section > .rt01-skills:first-of-type,
      [data-resume-pdf-capture="1"] .resume-template-01 section > .rt01-languages:first-of-type {
        margin-top: 2px !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 section > ul:first-of-type {
        margin-top: 6px !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 .rt01-dates,
      [data-resume-pdf-capture="1"] .resume-template-01 .rt01-sub,
      [data-resume-pdf-capture="1"] .resume-template-01 .rt01-project-tech,
      [data-resume-pdf-capture="1"] .resume-template-01 em,
      [data-resume-pdf-capture="1"] .resume-template-01 i {
        font-family: ${PDF_TIMES_STACK} !important;
        font-style: italic !important;
        font-weight: 400 !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 ul {
        list-style: none !important;
        margin: 6px 0 0 !important;
        padding-left: 0 !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 li {
        list-style: none !important;
        display: flex !important;
        align-items: flex-start !important;
        gap: 8px !important;
        margin-bottom: 2px !important;
        padding-left: 0 !important;
      }
      [data-resume-pdf-capture="1"] .resume-template-01 li::marker {
        content: none !important;
      }
      [data-resume-pdf-capture="1"] .cb-pdf-bullet {
        flex: 0 0 12px;
        width: 12px;
        text-align: center;
        line-height: 1.38;
        font-family: ${PDF_TIMES_STACK} !important;
        font-weight: 400 !important;
        font-style: normal !important;
      }
      [data-resume-pdf-capture="1"] .cb-pdf-bullet-text {
        flex: 1 1 auto;
        min-width: 0;
        line-height: 1.38;
        font-family: ${PDF_TIMES_STACK} !important;
        font-weight: 400 !important;
        font-style: normal !important;
      }
      [data-resume-pdf-capture="1"] .cb-pdf-bullet-text strong,
      [data-resume-pdf-capture="1"] .cb-pdf-bullet-text b {
        font-weight: 700 !important;
        font-style: normal !important;
      }
    `;
    clonedDoc.head.appendChild(style);
  }

  // html2canvas often drops ::marker — rewrite list items so bullet + text stay aligned.
  // Skip skills lists (should stay comma/inline, never bullets).
  const lists = clonedDoc.querySelectorAll(
    '[data-resume-pdf-capture="1"] .resume-template-01 ul:not(.rt01-skills-list)',
  );
  lists.forEach((ul) => {
    if (ul.classList.contains('rt01-skills') || ul.closest('.rt01-skills')) return;
    ul.querySelectorAll(':scope > li').forEach((li) => {
      if (li.querySelector('.cb-pdf-bullet')) return;
      const textWrap = clonedDoc.createElement('span');
      textWrap.className = 'cb-pdf-bullet-text';
      while (li.firstChild) {
        textWrap.appendChild(li.firstChild);
      }
      const bullet = clonedDoc.createElement('span');
      bullet.className = 'cb-pdf-bullet';
      bullet.setAttribute('aria-hidden', 'true');
      bullet.textContent = '•';
      li.appendChild(bullet);
      li.appendChild(textWrap);
    });
  });
}

/**
 * Render the live preview template off-screen, rasterize it, and place pages into an A4 PDF.
 */
export async function renderMasterResumePdf(doc: MasterResumeDocument): Promise<Uint8Array> {
  if (typeof document === 'undefined') {
    throw new Error('PDF download requires a browser environment.');
  }

  const data = masterResumeToAtsData(doc);
  const Template = getTemplateComponent('resume-template-01');

  const host = document.createElement('div');
  host.setAttribute('data-resume-pdf-capture', '1');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${PAGE_WIDTH_PX}px`,
    `min-width:${PAGE_WIDTH_PX}px`,
    'background:#ffffff',
    'z-index:-1',
    'pointer-events:none',
    'overflow:visible',
    `font-family:${PDF_TIMES_STACK}`,
  ].join(';');

  const sheet = document.createElement('div');
  sheet.className = 'preview-sheet';
  sheet.style.cssText = [
    `width:${PAGE_WIDTH_PX}px`,
    `min-width:${PAGE_WIDTH_PX}px`,
    'background:#ffffff',
    'box-sizing:border-box',
    'overflow:visible',
    `font-family:${PDF_TIMES_STACK}`,
  ].join(';');
  host.appendChild(sheet);
  document.body.appendChild(host);

  const root = createRoot(sheet);
  root.render(createElement(Template, { data }));

  try {
    await waitFrames(2);
    await waitForFonts();
    // Allow layout/paint after fonts
    await new Promise((r) => window.setTimeout(r, 80));
    await waitFrames(1);

    // Measure content height at each density and pick the best page fit.
    const resumeEl = sheet.querySelector('.resume') as HTMLElement | null;
    if (resumeEl) {
      const heights: Record<string, number> = {};
      for (const level of DENSITY_LEVELS) {
        sheet.dataset.density = level;
        void resumeEl.offsetHeight;
        heights[level] = resumeEl.scrollHeight;
      }
      const { density, overfull } = pickDensityLevel(heights, PAGE_HEIGHT_PX);
      sheet.dataset.density = density;
      sheet.classList.toggle('resume-fitted', !overfull);
      sheet.classList.toggle('resume-overfull', overfull);
      // If still short on one page after relaxed, stretch spacing slightly via relaxed.
      if (!overfull && density === 'relaxed' && heights.relaxed < PAGE_HEIGHT_PX * 0.72) {
        sheet.dataset.density = 'relaxed';
      }
      await waitFrames(1);
    }

    // Measured from the html2canvas clone (post PDF-only styles) so link hit-boxes match pixels.
    let resumeLinks: ResumeLinkBox[] = [];

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: PAGE_WIDTH_PX,
      windowWidth: PAGE_WIDTH_PX,
      logging: false,
      imageTimeout: 15000,
      onclone: (clonedDoc) => {
        preparePdfCaptureClone(clonedDoc);
        resumeLinks = collectResumeLinkBoxes(clonedDoc);
      },
    });

    const scale = canvas.width / PAGE_WIDTH_PX;
    const pageHeightCanvas = Math.max(1, Math.round(PAGE_HEIGHT_PX * scale));
    const totalPages = Math.max(1, Math.ceil(canvas.height / pageHeightCanvas));

    const pdf = await PDFDocument.create();

    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      const sourceY = pageIndex * pageHeightCanvas;
      const sliceHeight = Math.min(pageHeightCanvas, canvas.height - sourceY);
      if (sliceHeight <= 0) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create PDF page canvas.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        sourceY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        pageCanvas.toBlob(
          (next) => (next ? resolve(next) : reject(new Error('Could not encode PDF page.'))),
          'image/png',
        );
      });
      const pngBytes = new Uint8Array(await blob.arrayBuffer());
      const image = await pdf.embedPng(pngBytes);
      const page = pdf.addPage([PDF_WIDTH, PDF_HEIGHT]);

      // Map captured A4-width slice onto the PDF page (full width, top-aligned).
      const drawWidth = PDF_WIDTH;
      const drawHeight = (sliceHeight / canvas.width) * PDF_WIDTH;
      page.drawImage(image, {
        x: 0,
        y: PDF_HEIGHT - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });

      // Overlay real PDF URI annotations on LinkedIn / GitHub / other resume-link text.
      // Use the same rounded page stride as the canvas slicer (scale-aware).
      const pageHeightPx = pageHeightCanvas / scale;
      const sliceHeightPx = sliceHeight / scale;
      addLinksForPage(
        page,
        resumeLinks,
        pageIndex,
        pageHeightPx,
        PAGE_WIDTH_PX,
        drawWidth,
        drawHeight,
        sliceHeightPx,
      );
    }

    return pdf.save();
  } finally {
    try {
      root.unmount();
    } catch {
      /* ignore */
    }
    host.remove();
  }
}

export async function downloadMasterResumePdf(doc: MasterResumeDocument, fileName?: string) {
  const bytes = await renderMasterResumePdf(doc);
  savePdfBytes(
    bytes,
    fileName || `${(doc.personalInfo.fullName || 'Resume').replace(/\s+/g, '-')}-Resume.pdf`,
  );
}
