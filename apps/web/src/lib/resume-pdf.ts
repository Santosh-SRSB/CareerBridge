import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ResumeContent } from '@careerbridge/shared';

const NAVY = rgb(10 / 255, 46 / 255, 44 / 255);
const GOLD = rgb(202 / 255, 138 / 255, 4 / 255);
const MUTED = rgb(78 / 255, 104 / 255, 100 / 255);
const INK = rgb(18 / 255, 49 / 255, 50 / 255);
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

export async function photoUrlToJpegBytes(photoUrl: string) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, image.naturalWidth || 240);
      canvas.height = Math.max(1, image.naturalHeight || 300);
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Could not read that photo.'));
        return;
      }
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (next) => (next ? resolve(next) : reject(new Error('Could not encode that photo.'))),
        'image/jpeg',
        0.86,
      );
    };
    image.onerror = () => reject(new Error('Could not load that photo.'));
    image.src = photoUrl;
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderResumePdf(
  content: ResumeContent,
  template = 'CLASSIC',
  photoBytes?: Uint8Array | null,
) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const photo = photoBytes?.length ? await doc.embedJpg(photoBytes) : null;
  const { width, height } = page.getSize();
  const left = 48;
  const right = width - 48;
  let y = height - 52;
  const accent = template === 'MODERN' ? rgb(20 / 255, 184 / 255, 166 / 255) : GOLD;

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
    maxWidth: photo ? right - left - PHOTO_W - 16 : right - left,
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
    const lines = wrap(text, font, size, right - left);
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

  if (content.languages.length) {
    section('Languages');
    para(content.languages.join('  ·  '));
  }

  return await doc.save();
}

export function savePdfBytes(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadResumePdfFile(options: {
  content: ResumeContent;
  template?: string;
  photoUrl?: string | null;
  fileName?: string;
}) {
  let photoBytes: Uint8Array | null = null;
  if (options.photoUrl) {
    try {
      photoBytes = await photoUrlToJpegBytes(options.photoUrl);
    } catch {
      photoBytes = null;
    }
  }
  const bytes = await renderResumePdf(options.content, options.template || 'CLASSIC', photoBytes);
  savePdfBytes(bytes, options.fileName || 'resume.pdf');
}
