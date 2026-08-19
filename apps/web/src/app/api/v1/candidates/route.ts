import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function completion(input: {
  firstName: string;
  city?: string | null;
  about?: string | null;
  educationCount: number;
  skillCount: number;
}) {
  let score = 0;
  if (input.firstName) score += 25;
  if (input.city) score += 15;
  if (input.about) score += 20;
  if (input.educationCount > 0) score += 20;
  if (input.skillCount > 0) score += 20;
  return score;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    if (!firstName) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NAME_REQUIRED", message: "Full name is required." },
        },
        { status: 400 },
      );
    }

    const lastName = String(body.lastName ?? "").trim();
    const city = String(body.city ?? "").trim() || null;
    const about = String(body.about ?? "").trim() || null;
    const source = body.source === "resume" ? "resume" : "manual";
    const education = Array.isArray(body.education) ? body.education : [];
    const skills = Array.isArray(body.skills)
      ? body.skills.map((item: unknown) => String(item).trim()).filter(Boolean)
      : [];

    const educationRows = education
      .map((row: { qualification?: string; institution?: string; fieldOfStudy?: string; yearCompleted?: string }) => ({
        qualification: String(row.qualification ?? "").trim(),
        institution: String(row.institution ?? "").trim() || null,
        fieldOfStudy: String(row.fieldOfStudy ?? "").trim() || null,
        yearCompleted: String(row.yearCompleted ?? "").trim() || null,
      }))
      .filter((row: { qualification: string }) => row.qualification);

    const profileCompletion = completion({
      firstName,
      city,
      about,
      educationCount: educationRows.length,
      skillCount: skills.length,
    });

    const user = await prisma.user.create({
      data: {
        userType: "CANDIDATE",
        candidate: {
          create: {
            firstName,
            lastName,
            city,
            about,
            source,
            profileCompletion,
            education: { create: educationRows },
            skills: { create: skills.map((name: string) => ({ name })) },
          },
        },
      },
      include: {
        candidate: {
          include: { education: true, skills: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.candidate?.id,
        profileCompletion,
        status: user.status,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "PASSPORT_SAVE_FAILED",
          message: "We could not save your Career Passport. Check the database connection.",
        },
      },
      { status: 500 },
    );
  }
}
