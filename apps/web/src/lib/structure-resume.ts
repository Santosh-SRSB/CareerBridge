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
          "Extract only name, education, skills and career interests from the resume. Ignore experience, city, about and job preferences. Return JSON only. Use empty strings or empty arrays when a field is missing. Do not invent degrees or skills. Career interests can be known options (Customer Service, Retail, Technology, Sales, Office/Admin, Delivery/Logistics) or other short labels found in the resume.",
      },
      {
        role: "user",
        content: `Resume text:\n${rawText.slice(0, 14000)}\n\nReturn this JSON shape:\n${JSON.stringify(
          {
            firstName: "",
            lastName: "",
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
