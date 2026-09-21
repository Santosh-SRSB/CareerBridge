import { PDFParse } from "pdf-parse";
import { extractReadableText } from "@/lib/parse-resume";

/**
 * Extract resume text with the same layout-aware reading order used by the API.
 * Do not use raw getText() alone for PDFs — column interleaving contaminates sections.
 */
export async function extractResumeText(file: File, buffer: Buffer) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isText = file.type.startsWith("text/") || name.endsWith(".txt");

  if (isText) {
    return buffer.toString("utf8");
  }

  if (isPdf) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText({
        lineEnforce: true,
        cellSeparator: "\t",
        cellThreshold: 12,
        pageJoiner: "",
      });
      const pages = Array.isArray(result.pages) && result.pages.length
        ? result.pages
        : [{ num: 1, text: result.text || "" }];

      // Inline two-column reconstruction (keep web free of api imports).
      const chunks: string[] = [];
      for (const page of pages) {
        const lines = String(page.text || "")
          .split(/\r?\n/)
          .map((l) => l.trimEnd())
          .filter((l) => l.trim());
        const tabbed = lines.filter((l) => l.includes("\t"));
        const twoColumn = tabbed.length >= Math.max(2, Math.floor(lines.length * 0.25));
        if (!twoColumn) {
          chunks.push(lines.map((l) => l.replace(/\t+/g, " ").trim()).join("\n"));
          continue;
        }
        const left: string[] = [];
        const right: string[] = [];
        for (const line of lines) {
          if (line.includes("\t")) {
            const parts = line.split(/\t+/).map((p) => p.trim()).filter(Boolean);
            if (parts[0]) left.push(parts[0]);
            if (parts.length > 1) right.push(parts.slice(1).join(" "));
          } else {
            left.push(line.trim());
          }
        }
        chunks.push([...left, ...right].join("\n"));
      }
      return chunks.join("\n\n").trim();
    } finally {
      await parser.destroy();
    }
  }

  return extractReadableText(buffer);
}
