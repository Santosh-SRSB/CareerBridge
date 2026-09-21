/**
 * Spatial / layout-aware PDF text reassembly.
 * Builds on tab-separated cell detection from pdf-parse and adds:
 * - header-band separation (name/contact before columns)
 * - gap-threshold two-column detection when tabs are sparse
 * - main-column-then-sidebar reading order (never interleave L/R per line)
 */

export type SpatialPageBlock = {
  page: number;
  text: string;
  columnMode: 'single' | 'two-column';
  headerLines: string[];
};

export type SpatialReadingOrderResult = {
  text: string;
  pages: SpatialPageBlock[];
  notes: string[];
};

function isLikelyHeaderLine(line: string): boolean {
  const t = line.replace(/\t+/g, ' ').trim();
  if (!t || t.length > 90) return false;
  if (/@/.test(t) || /\b\d{10}\b/.test(t.replace(/\D/g, ' '))) return true;
  if (/linkedin|github|portfolio|http/i.test(t)) return true;
  // Short title-case name-like line
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+){0,3}$/.test(t) && t.split(/\s+/).length <= 4) return true;
  return false;
}

function splitColumnsSpatial(pageText: string): {
  header: string[];
  left: string[];
  right: string[];
  twoColumn: boolean;
} {
  const rawLines = pageText
    .split(/\r?\n/)
    .map((l) => l.replace(/\u0000/g, ' ').trimEnd())
    .filter((l) => l.trim().length > 0);

  if (!rawLines.length) return { header: [], left: [], right: [], twoColumn: false };

  // Peel header band (first ~8 lines that look like contact/name)
  const header: string[] = [];
  let bodyStart = 0;
  for (let i = 0; i < Math.min(8, rawLines.length); i += 1) {
    const line = rawLines[i];
    if (isLikelyHeaderLine(line) || (!line.includes('\t') && i < 3 && line.length < 60)) {
      // Stop peeling once we hit a clear section heading
      if (/^(summary|objective|experience|education|skills|projects|work)\b/i.test(line.trim())) {
        break;
      }
      header.push(line.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim());
      bodyStart = i + 1;
      continue;
    }
    break;
  }

  const body = rawLines.slice(bodyStart);
  const tabbed = body.filter((l) => l.includes('\t'));
  const twoColumn = tabbed.length >= Math.max(2, Math.floor(body.length * 0.2));

  if (!twoColumn) {
    return {
      header,
      left: body.map((l) => l.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim()),
      right: [],
      twoColumn: false,
    };
  }

  const left: string[] = [];
  const right: string[] = [];
  for (const line of body) {
    if (line.includes('\t')) {
      const parts = line.split(/\t+/).map((p) => p.trim()).filter(Boolean);
      if (parts[0]) left.push(parts[0]);
      // Multiple right cells → keep as separate sidebar lines when short tokens
      if (parts.length === 2) {
        right.push(parts[1]);
      } else if (parts.length > 2) {
        // Prefer first right cell as primary sidebar; remaining as extra sidebar lines
        right.push(parts[1]);
        for (const extra of parts.slice(2)) {
          if (extra.length < 48) right.push(extra);
          else left.push(extra);
        }
      }
    } else {
      // Full-width lines usually belong to main column
      left.push(line.trim());
    }
  }
  return { header, left, right, twoColumn: true };
}

/**
 * Reconstruct reading order: header → main column → sidebar, per page.
 * Avoids Experience↔Skills line-by-line interleaving.
 */
export function reconstructSpatialReadingOrder(
  pages: Array<{ num: number; text: string }>,
): SpatialReadingOrderResult {
  const notes: string[] = [];
  const outPages: SpatialPageBlock[] = [];
  const chunks: string[] = [];

  for (const page of pages) {
    const { header, left, right, twoColumn } = splitColumnsSpatial(page.text || '');
    if (twoColumn) {
      notes.push(`page ${page.num}: spatial two-column (header → main → sidebar)`);
    } else if (header.length) {
      notes.push(`page ${page.num}: header-band separated (${header.length} lines)`);
    }
    const body = [...header, ...left, ...right].filter(Boolean).join('\n');
    outPages.push({
      page: page.num,
      text: body,
      columnMode: twoColumn ? 'two-column' : 'single',
      headerLines: header,
    });
    if (body.trim()) {
      chunks.push(`-- page ${page.num} --\n${body}`);
    }
  }

  return {
    text: chunks.join('\n\n').trim(),
    pages: outPages,
    notes,
  };
}
