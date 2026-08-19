import { NextResponse } from "next/server";
import { extractReadableText, parseResumeText } from "@/lib/parse-resume";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FILE_REQUIRED", message: "Please drop a resume file." },
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text =
      file.type.startsWith("text/") || file.name.endsWith(".txt")
        ? buffer.toString("utf8")
        : extractReadableText(buffer);

    const draft = parseResumeText(text || file.name.replace(/\.[^.]+$/, ""));
    return NextResponse.json({ success: true, data: draft });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RESUME_PARSE_FAILED",
          message: "We could not read that resume. You can fill the form manually.",
        },
      },
      { status: 400 },
    );
  }
}
