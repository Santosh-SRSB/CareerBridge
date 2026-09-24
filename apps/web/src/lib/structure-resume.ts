import type { PassportDraft } from "@/types/passport";
import { toPassportDraft } from "@/lib/parse-resume";

/**
 * Structure resume text via Nest AI Gateway (Gemini only).
 * Never calls OpenAI or any local heuristic LLM substitute from the Next.js layer.
 */
export async function structureResumeText(rawText: string): Promise<PassportDraft> {
  const apiUrl =
    (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "") ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3001/api/v1" : "");
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured for this environment.");
  }

  const response = await fetch(`${apiUrl}/resumes/structure-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText }),
  });
  const body = (await response.json()) as {
    success?: boolean;
    data?: unknown;
    error?: { message?: string };
  };
  if (response.ok && body.success && body.data) {
    return toPassportDraft(body.data, "resume");
  }

  throw new Error(body.error?.message || "AI resume structuring failed. Please retry.");
}
