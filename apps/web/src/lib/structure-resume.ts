import type { PassportDraft } from "@/types/passport";
import { parseResumeText, toPassportDraft } from "@/lib/parse-resume";

/**
 * Structure resume text via Nest AI Gateway (Gemini only).
 * Never calls OpenAI or any LLM from the Next.js layer.
 */
export async function structureResumeText(rawText: string): Promise<PassportDraft> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

  try {
    const response = await fetch(`${apiUrl}/resumes/structure-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    const body = (await response.json()) as {
      success?: boolean;
      data?: unknown;
    };
    if (response.ok && body.success && body.data) {
      return toPassportDraft(body.data, "resume");
    }
  } catch (error) {
    console.error("AI Gateway structure-text failed; using local parser", error);
  }

  return parseResumeText(rawText);
}
