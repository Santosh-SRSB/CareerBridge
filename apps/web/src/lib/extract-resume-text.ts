import { PDFParse } from "pdf-parse";
import { extractReadableText } from "@/lib/parse-resume";

export async function extractResumeText(file: File, buffer: Buffer) {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isText =
    file.type.startsWith("text/") || name.endsWith(".txt");

  if (isText) {
    return buffer.toString("utf8");
  }

  if (isPdf) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text.trim();
    } finally {
      await parser.destroy();
    }
  }

  return extractReadableText(buffer);
}
