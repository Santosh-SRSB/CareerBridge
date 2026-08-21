import { NextResponse } from "next/server";
import { extractResumeText } from "@/lib/extract-resume-text";
import { parseResumeText } from "@/lib/parse-resume";
import { structureResumeText } from "@/lib/structure-resume";

export const runtime = "nodejs";

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
    const rawText = await extractResumeText(file, buffer);
    if (!rawText.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RESUME_EMPTY",
            message: "We could not extract text from that file. Try a text-based PDF.",
          },
        },
        { status: 400 },
      );
    }

    let draft;
    try {
      draft = await structureResumeText(rawText);
    } catch (error) {
      console.error(error);
      draft = parseResumeText(rawText);
    }

    let parseId: string | undefined;
    try {
      const { prisma } = await import("@/lib/prisma");
      const saved = await prisma.resumeParse.create({
        data: {
          fileName: file.name,
          rawText,
          structured: draft,
        },
      });
      parseId = saved.id;
    } catch (error) {
      console.error(error);
    }

    return NextResponse.json({
      success: true,
      data: draft,
      parseId,
    });
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
