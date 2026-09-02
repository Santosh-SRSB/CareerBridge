import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { InterviewSession } from '@careerbridge/shared';

export async function renderInterviewPdf(session: InterviewSession) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;
  const ink = rgb(0.05, 0.18, 0.17);
  const muted = rgb(0.3, 0.4, 0.38);

  const line = (text: string, size = 11, useBold = false) => {
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(win(text).slice(0, 110), {
      x: 40,
      y,
      size,
      font: useBold ? bold : font,
      color: ink,
    });
    y -= size + 8;
  };

  const report = session.report;
  line('SRSB CareerBridge — AI Interview Report', 16, true);
  line(`${session.jobRole} · ${session.interviewType}`);
  line(`Start: ${session.startAt || '-'}  End: ${session.endAt || '-'}`);
  line(`Duration: ${format(session.durationSec || 0)}`);
  line(
    `Overall ${report?.overallScore ?? session.score ?? 0}/100   Communication ${session.communicationScore ?? report?.communication ?? 0}/10   Behaviour ${session.behaviourScore ?? report?.behaviour ?? 0}/10   Listening ${session.listeningScore ?? report?.listening ?? 0}/10`,
  );
  line(
    `Answered ${report?.answeredCount ?? (session.liveQuestions || []).filter((item) => item.answer).length} of ${report?.totalPlanned ?? 15} questions`,
  );
  line(`Recommendation: ${report?.recommendation || '-'}`, 12, true);
  y -= 6;
  line('Summary', 13, true);
  wrap(report?.summary || '', line);
  line('Strengths', 13, true);
  (report?.strengths || []).forEach((item) => line(`- ${item}`));
  line('Areas to improve', 13, true);
  (report?.weaknesses || []).forEach((item) => line(`- ${item}`));
  line("Do's", 13, true);
  (report?.dos || []).forEach((item) => line(`- ${item}`));
  line("Don'ts", 13, true);
  (report?.donts || []).forEach((item) => line(`- ${item}`));
  line(
    `Integrity — tab ${report?.integrity.tabSwitches ?? 0}, face missing ${report?.integrity.faceMissing ?? 0}, multiple faces ${report?.integrity.multipleFaces ?? 0}, mic ${report?.integrity.micIssues ?? 0}`,
  );
  (session.liveQuestions || [])
    .filter((item) => (item.answer || '').trim().length > 0)
    .forEach((item) => {
    y -= 6;
    line(`Question ${item.number}`, 13, true);
    wrap(item.text, line);
    line('Your answer', 11, true);
    wrap(item.answer || '(no answer)', line);
    line('What can be improved', 11, true);
    wrap(item.analysis || '', line);
    line('Improved answer (based on your response)', 11, true);
    wrap(item.improvedAnswer || '', line);
    line(`Score ${item.score ?? 0}/100`);
  });
  page.drawText('Practice only. Recruiters make hiring decisions.', {
    x: 40,
    y: 30,
    size: 9,
    font,
    color: muted,
  });
  return Buffer.from(await doc.save());
}

function wrap(text: string, line: (value: string) => void) {
  const words = win(text).split(/\s+/);
  let row = '';
  for (const word of words) {
    if ((row + ' ' + word).length > 95) {
      line(row);
      row = word;
    } else row = row ? `${row} ${word}` : word;
  }
  if (row) line(row);
}

function format(sec: number) {
  return `${Math.floor(sec / 60)} min ${sec % 60} sec`;
}

function win(value: string) {
  return value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
}
