import OpenAI from "openai";
import type { PassportDraft } from "@/types/passport";
import { parseResumeText, toPassportDraft } from "@/lib/parse-resume";

function openaiKey() {
  return process.env.Open_Ai_Api_key?.trim() || process.env.OPENAI_API_KEY?.trim() || "";
}

export async function structureResumeText(rawText: string): Promise<PassportDraft> {
  const apiKey = openaiKey();
  if (!apiKey) {
    return parseResumeText(rawText);
  }

  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract resume facts only. Do not invent companies, titles, dates, skills, metrics or degrees. Return JSON only. Use empty strings or empty arrays when missing.",
      },
      {
        role: "user",
        content: `Resume text:\n${rawText.slice(0, 14000)}\n\nReturn this JSON shape:\n${JSON.stringify(
          {
            firstName: "",
            lastName: "",
            city: "",
            about: "",
            education: [
              {
                qualification: "",
                institution: "",
                fieldOfStudy: "",
                yearCompleted: "",
              },
            ],
            skills: [""],
            careerInterests: [""],
            experience: [
              {
                company: "",
                jobTitle: "",
                isInternship: false,
                description: "",
              },
            ],
          },
        )}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    return parseResumeText(rawText);
  }

  try {
    return toPassportDraft(JSON.parse(content), "resume");
  } catch {
    return parseResumeText(rawText);
  }
}
