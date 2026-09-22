/**
 * Reconstruct logical reading order from pdf-parse page text.
 * Delegates to spatial-pdf-layout for header-band + two-column assembly.
 */

import {
  reconstructSpatialReadingOrder,
  type SpatialPageBlock,
  type SpatialReadingOrderResult,
} from './spatial-pdf-layout';

export type PageTextBlock = {
  page: number;
  text: string;
  columnMode: 'single' | 'two-column';
};

export type ReadingOrderResult = {
  text: string;
  pages: PageTextBlock[];
  notes: string[];
};

/**
 * Build document text as: for each page, header → left/main column → right/sidebar.
 * This avoids interleaving Experience lines with Skills lines from a sidebar.
 */
export function reconstructReadingOrder(
  pages: Array<{ num: number; text: string }>,
): ReadingOrderResult {
  const spatial: SpatialReadingOrderResult = reconstructSpatialReadingOrder(pages);
  return {
    text: spatial.text,
    notes: spatial.notes,
    pages: spatial.pages.map((p: SpatialPageBlock) => ({
      page: p.page,
      text: p.text,
      columnMode: p.columnMode,
    })),
  };
}

/** Strip decorative page markers we inject (kept only for diagnostics). */
export function stripInternalPageMarkers(text: string): string {
  return text
    .replace(/^-- page \d+ --\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
