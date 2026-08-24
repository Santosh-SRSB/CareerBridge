import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  validateRewrite,
  type AtsFact,
  type AtsIssue,
  type ResumeChangeRecord,
  type ResumeContent,
} from '@careerbridge/shared';

@Injectable()
export class ResumeOptimizeAi {
  constructor(private readonly config: ConfigService) {}

  async rewrite(
    content: ResumeContent,
    issues: AtsIssue[],
    facts: AtsFact[],
  ): Promise<{ content: ResumeContent; changes: ResumeChangeRecord[] } | null> {
    const apiKey =
      this.config.get<string>('OPENAI_API_KEY')?.trim() ||
      this.config.get<string>('Open_Ai_Api_key')?.trim() ||
      '';
    if (!apiKey) return null;

    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You improve resume wording only. Never invent companies, titles, dates, skills, metrics, certifications, team sizes, users, or achievements. Return JSON { changes: [{ section, originalText, suggestedText, reason }] }. Each suggestion must be a wording improvement of originalText.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            content,
            facts: facts.map((item) => ({ type: item.type, value: item.value })),
            issues: issues.slice(0, 12).map((item) => ({
              section: item.section,
              problem: item.problem,
              recommendation: item.recommendation,
              originalExample: item.originalExample,
            })),
          }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    let parsed: { changes?: Array<{ section: string; originalText: string; suggestedText: string; reason: string }> };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      return null;
    }

    const next: ResumeContent = JSON.parse(JSON.stringify(content)) as ResumeContent;
    const accepted: ResumeChangeRecord[] = [];
    for (const change of parsed.changes || []) {
      const check = validateRewrite(change.originalText, change.suggestedText, facts);
      const record: ResumeChangeRecord = {
        id: `c${accepted.length + 1}`,
        section: change.section || 'Resume',
        originalText: change.originalText,
        suggestedText: change.suggestedText,
        reason: change.reason || 'Improved clarity.',
        validation: check.result,
        factIds: facts.slice(0, 8).map((item) => item.id),
      };
      if (check.result !== 'PASS') continue;
      const applied = applyText(next, change.originalText, change.suggestedText);
      if (applied) accepted.push(record);
    }
    return { content: next, changes: accepted };
  }
}

function applyText(content: ResumeContent, original: string, suggested: string) {
  const from = original.trim();
  const to = suggested.trim();
  if (!from || from === to) return false;
  if (content.summary.includes(from)) {
    content.summary = content.summary.replace(from, to);
    return true;
  }
  for (const item of content.experiences) {
    if (item.description?.includes(from)) {
      item.description = item.description.replace(from, to);
      return true;
    }
  }
  return false;
}
