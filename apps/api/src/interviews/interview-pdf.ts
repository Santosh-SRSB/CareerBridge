import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { InterviewSession } from '@careerbridge/shared';

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 40;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const INK = rgb(0.08, 0.14, 0.16);
const MUTED = rgb(0.35, 0.42, 0.44);
const TEAL = rgb(0.05, 0.42, 0.4);
const QUESTION_RED = rgb(0.72, 0.16, 0.22);
const ANSWER_GREEN = rgb(0.08, 0.45, 0.32);
const IMPROVED_TEAL = rgb(0.05, 0.38, 0.36);
const LIGHT_RED = rgb(0.98, 0.93, 0.93);
const LIGHT_GREEN = rgb(0.92, 0.97, 0.94);
const LIGHT_TEAL = rgb(0.9, 0.96, 0.95);
const CARD_BORDER = rgb(0.86, 0.9, 0.9);
const WHITE = rgb(1, 1, 1);

export async function renderInterviewPdf(session: InterviewSession) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 36;

  const ensure = (need: number) => {
    if (y - need < 48) {
      page.drawText('Practice only. Recruiters make hiring decisions.', {
        x: MARGIN_X,
        y: 28,
        size: 8,
        font,
        color: MUTED,
      });
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 40;
    }
  };

  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: RGB; x?: number; maxWidth?: number } = {},
  ) => {
    const size = opts.size ?? 10;
    const useBold = opts.bold ?? false;
    const color = opts.color ?? INK;
    const x = opts.x ?? MARGIN_X;
    const maxWidth = opts.maxWidth ?? CONTENT_W;
    const lines = wrapLines(win(text), useBold ? bold : font, size, maxWidth);
    for (const row of lines) {
      ensure(size + 6);
      page.drawText(row, { x, y, size, font: useBold ? bold : font, color });
      y -= size + 4;
    }
    return lines.length;
  };

  const drawBanner = () => {
    ensure(70);
    page.drawRectangle({
      x: 0,
      y: y - 52,
      width: PAGE_W,
      height: 64,
      color: TEAL,
    });
    page.drawText(win('SRSB CareerBridge'), {
      x: MARGIN_X,
      y: y - 18,
      size: 11,
      font: bold,
      color: WHITE,
    });
    page.drawText(win('AI Mock Interview Report'), {
      x: MARGIN_X,
      y: y - 38,
      size: 16,
      font: bold,
      color: WHITE,
    });
    y -= 72;
  };

  const drawChip = (label: string, value: string, x: number) => {
    page.drawRectangle({
      x,
      y: y - 28,
      width: 118,
      height: 34,
      color: LIGHT_TEAL,
      borderColor: CARD_BORDER,
      borderWidth: 0.6,
    });
    page.drawText(win(label), { x: x + 8, y: y - 12, size: 7, font, color: MUTED });
    page.drawText(win(value), { x: x + 8, y: y - 24, size: 11, font: bold, color: TEAL });
  };

  drawBanner();
  drawText(`${session.jobRole}  ·  ${session.interviewType}`, { size: 11, bold: true, color: TEAL });
  drawText(
    `Start: ${session.startAt || '—'}   End: ${session.endAt || '—'}   Duration: ${format(session.durationSec || 0)}`,
    { size: 9, color: MUTED },
  );
  y -= 6;

  const report = session.report;
  ensure(44);
  drawChip('Overall', `${report?.overallScore ?? session.score ?? 0}/100`, MARGIN_X);
  drawChip('Communication', `${session.communicationScore ?? report?.communication ?? 0}/10`, MARGIN_X + 128);
  drawChip('Behaviour', `${session.behaviourScore ?? report?.behaviour ?? 0}/10`, MARGIN_X + 256);
  drawChip('Listening', `${session.listeningScore ?? report?.listening ?? 0}/10`, MARGIN_X + 384);
  y -= 42;

  drawText(
    `Answered ${report?.answeredCount ?? (session.liveQuestions || []).filter((item) => item.answer).length} of ${report?.totalPlanned ?? 15} questions`,
    { size: 9, color: MUTED },
  );
  drawText(`Recommendation: ${report?.recommendation || '—'}`, { size: 12, bold: true, color: TEAL });
  y -= 4;

  sectionTitle(page, font, bold, 'Summary', y);
  y -= 18;
  drawText(report?.summary || '—', { size: 10 });
  y -= 4;

  sectionTitle(page, font, bold, 'Strengths', y);
  y -= 18;
  for (const item of report?.strengths || []) drawText(`• ${item}`, { size: 10, color: ANSWER_GREEN });
  y -= 4;

  sectionTitle(page, font, bold, 'Areas to improve', y);
  y -= 18;
  for (const item of report?.weaknesses || []) drawText(`• ${item}`, { size: 10, color: QUESTION_RED });
  y -= 4;

  sectionTitle(page, font, bold, "Do's", y);
  y -= 18;
  for (const item of report?.dos || []) drawText(`• ${item}`, { size: 10 });
  y -= 2;

  sectionTitle(page, font, bold, "Don'ts", y);
  y -= 18;
  for (const item of report?.donts || []) drawText(`• ${item}`, { size: 10 });
  y -= 4;

  drawText(
    `Integrity — tab ${report?.integrity.tabSwitches ?? 0}, face missing ${report?.integrity.faceMissing ?? 0}, multiple faces ${report?.integrity.multipleFaces ?? 0}, mic ${report?.integrity.micIssues ?? 0}`,
    { size: 8, color: MUTED },
  );
  y -= 10;

  sectionTitle(page, font, bold, 'Question-by-question feedback', y);
  y -= 20;

  const answered = (session.liveQuestions || []).filter((item) => (item.answer || '').trim().length > 0);
  for (const item of answered) {
    const qLines = wrapLines(win(item.text), font, 10, CONTENT_W - 16);
    const aLines = wrapLines(win(item.answer || '(no answer)'), font, 10, CONTENT_W - 16);
    const analysisLines = wrapLines(win(item.analysis || '—'), font, 9, CONTENT_W - 16);
    const improvedLines = wrapLines(win(item.improvedAnswer || '—'), font, 10, CONTENT_W - 16);
    const blockH =
      22 +
      (qLines.length + aLines.length + analysisLines.length + improvedLines.length) * 13 +
      70;
    ensure(Math.min(blockH, 220));

    // Card background
    const cardTop = y + 4;
    const approxH = Math.min(blockH, y - 50);
    page.drawRectangle({
      x: MARGIN_X - 6,
      y: y - approxH + 8,
      width: CONTENT_W + 12,
      height: approxH,
      color: rgb(0.985, 0.99, 0.99),
      borderColor: CARD_BORDER,
      borderWidth: 0.8,
    });

    drawText(`Question ${item.number}  ·  Score ${item.score ?? 0}/100`, {
      size: 11,
      bold: true,
      color: TEAL,
    });
    y -= 2;

    // Question band (reddish)
    const qH = qLines.length * 13 + 18;
    ensure(qH + 8);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - qH + 10,
      width: CONTENT_W,
      height: qH,
      color: LIGHT_RED,
    });
    page.drawText('QUESTION', {
      x: MARGIN_X + 8,
      y: y - 2,
      size: 7,
      font: bold,
      color: QUESTION_RED,
    });
    y -= 12;
    for (const row of qLines) {
      ensure(14);
      page.drawText(row, { x: MARGIN_X + 8, y, size: 10, font, color: QUESTION_RED });
      y -= 13;
    }
    y -= 8;

    // Answer band (greenish)
    const aH = aLines.length * 13 + 18;
    ensure(aH + 8);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - aH + 10,
      width: CONTENT_W,
      height: aH,
      color: LIGHT_GREEN,
    });
    page.drawText('YOUR ANSWER', {
      x: MARGIN_X + 8,
      y: y - 2,
      size: 7,
      font: bold,
      color: ANSWER_GREEN,
    });
    y -= 12;
    for (const row of aLines) {
      ensure(14);
      page.drawText(row, { x: MARGIN_X + 8, y, size: 10, font, color: ANSWER_GREEN });
      y -= 13;
    }
    y -= 8;

    drawText('What can be improved', { size: 9, bold: true, color: MUTED });
    for (const row of analysisLines) {
      ensure(12);
      page.drawText(row, { x: MARGIN_X, y, size: 9, font, color: INK });
      y -= 12;
    }
    y -= 4;

    if (item.whatWasMissing?.length) {
      drawText('What was missing', { size: 9, bold: true, color: QUESTION_RED });
      for (const gap of item.whatWasMissing) {
        drawText(`• ${gap}`, { size: 9, color: QUESTION_RED });
      }
      y -= 2;
    }
    if (item.improvementSuggestion) {
      drawText('Improvement tip', { size: 9, bold: true, color: TEAL });
      drawText(item.improvementSuggestion, { size: 9, color: TEAL });
      y -= 2;
    }

    const iH = improvedLines.length * 13 + 18;
    ensure(iH + 8);
    page.drawRectangle({
      x: MARGIN_X,
      y: y - iH + 10,
      width: CONTENT_W,
      height: iH,
      color: LIGHT_TEAL,
    });
    page.drawText('IMPROVED ANSWER', {
      x: MARGIN_X + 8,
      y: y - 2,
      size: 7,
      font: bold,
      color: IMPROVED_TEAL,
    });
    y -= 12;
    for (const row of improvedLines) {
      ensure(14);
      page.drawText(row, { x: MARGIN_X + 8, y, size: 10, font, color: IMPROVED_TEAL });
      y -= 13;
    }
    y -= 16;
    void cardTop;
  }

  page.drawText('Practice only. Recruiters make hiring decisions.', {
    x: MARGIN_X,
    y: 28,
    size: 8,
    font,
    color: MUTED,
  });

  return Buffer.from(await doc.save());
}

function sectionTitle(page: PDFPage, font: PDFFont, bold: PDFFont, title: string, y: number) {
  page.drawText(win(title), { x: MARGIN_X, y, size: 12, font: bold, color: TEAL });
  page.drawRectangle({
    x: MARGIN_X,
    y: y - 4,
    width: 120,
    height: 1.2,
    color: TEAL,
  });
  void font;
}

function wrapLines(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return ['—'];
  const lines: string[] = [];
  let row = '';
  for (const word of words) {
    const next = row ? `${row} ${word}` : word;
    const width = font.widthOfTextAtSize(next, size);
    if (width > maxWidth && row) {
      lines.push(row);
      row = word;
    } else {
      row = next;
    }
  }
  if (row) lines.push(row);
  return lines;
}

function format(sec: number) {
  return `${Math.floor(sec / 60)} min ${sec % 60} sec`;
}

function win(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
}
