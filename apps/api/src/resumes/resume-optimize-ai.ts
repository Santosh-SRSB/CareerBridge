import { Injectable } from '@nestjs/common';
import {
  validateRewrite,
  type AtsFact,
  type AtsIssue,
  type ResumeChangeRecord,
  type ResumeContent,
} from '@careerbridge/shared';
import { AiGatewayService } from '../ai/ai-gateway.service';

@Injectable()
export class ResumeOptimizeAi {
  constructor(private readonly aiGateway: AiGatewayService) {}

  async rewrite(
    content: ResumeContent,
    issues: AtsIssue[],
    facts: AtsFact[],
  ): Promise<{ content: ResumeContent; changes: ResumeChangeRecord[] } | null> {
    if (!this.aiGateway.isConfigured()) return null;

    const parsed = await this.aiGateway.rewriteResume(
      content,
      issues.slice(0, 12).map((item) => ({
        section: item.section,
        problem: item.problem,
        recommendation: item.recommendation,
        originalExample: item.originalExample,
      })),
      facts.map((item) => ({ type: item.type, value: item.value })),
    );

    if (!parsed || !parsed.changes) return null;

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
