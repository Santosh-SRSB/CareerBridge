'use client';

import { useState } from 'react';
import { aiSuggestionsUnavailableMessage } from '@careerbridge/shared';
import { improveResumeExperience, improveResumeSummary } from '@/lib/api';
import { userFacingError } from '@/lib/client-errors';

const styles = `
  .cb-ai-assist { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
  .cb-ai-assist-btn {
    align-self: flex-start;
    min-height: 48px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1.5px solid #0A2E2C;
    background: #fff;
    color: #0A2E2C;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .cb-ai-assist-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .cb-ai-assist-card {
    border: 1.5px solid #c9d8c5;
    background: #f3f8f1;
    border-radius: 10px;
    padding: 12px;
    font-size: 13.5px;
    color: #1f2a24;
  }
  .cb-ai-assist-card p { margin: 0 0 10px; line-height: 1.5; }
  .cb-ai-assist-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .cb-ai-assist-card ul { margin: 0 0 10px; padding-left: 18px; line-height: 1.5; }
  .cb-ai-assist-actions button {
    min-height: 48px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  .cb-ai-assist-use { background: #0A2E2C; color: #fff; border: none; }
  .cb-ai-assist-dismiss { background: transparent; color: #0A2E2C; border: 1.5px solid #c9d0c2; }
  .cb-ai-assist-note { margin: 0; font-size: 12.5px; color: #7a3b00; }
`;

export function SummaryAiAssist({
  summary,
  targetRole,
  profile,
  onUse,
}: {
  summary: string;
  targetRole?: string;
  profile: Record<string, unknown>;
  onUse: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [note, setNote] = useState('');

  async function improve(previous?: string) {
    setBusy(true);
    setNote('');
    setSuggestion('');
    try {
      const result = await improveResumeSummary({ summary, targetRole, profile, ...(previous ? { avoid: [previous] } : {}) });
      if (result.aiAvailable) setSuggestion(result.improvedSummary);
      else setNote(aiSuggestionsUnavailableMessage(result.aiUnavailableReason));
    } catch (err) {
      setNote(userFacingError(err, 'improve your summary'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cb-ai-assist">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <button type="button" className="cb-ai-assist-btn" onClick={() => void improve()} disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'Improving…' : 'Improve with AI'}
      </button>
      {suggestion ? (
        <div className="cb-ai-assist-card" role="region" aria-label="AI suggested summary">
          <p>{suggestion}</p>
          <div className="cb-ai-assist-actions">
            <button
              type="button"
              className="cb-ai-assist-use"
              onClick={() => {
                onUse(suggestion);
                setSuggestion('');
              }}
            >
              Use this summary
            </button>
            <button type="button" className="cb-ai-assist-dismiss" onClick={() => setSuggestion('')}>
              Keep mine
            </button>
            <button type="button" className="cb-ai-assist-dismiss" onClick={() => void improve(suggestion)} disabled={busy}>
              Try again
            </button>
          </div>
        </div>
      ) : null}
      {note ? (
        <p className="cb-ai-assist-note" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}

export function ExperienceAiAssist({
  role,
  company,
  bullets,
  onUse,
}: {
  role: string;
  company?: string;
  bullets: string[];
  onUse: (bullets: string[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string[]>([]);
  const [note, setNote] = useState('');

  async function improve(previous?: string[]) {
    if (!role.trim()) {
      setNote('Add the job title first, then use Improve with AI.');
      return;
    }
    setBusy(true);
    setNote('');
    setSuggestion([]);
    try {
      const result = await improveResumeExperience({
        role: role.trim(),
        company: company?.trim() || undefined,
        bullets: bullets.map((b) => b.trim()).filter(Boolean),
        ...(previous?.length ? { avoid: [previous.join('\n')] } : {}),
      });
      if (result.aiAvailable) setSuggestion(result.improvedBullets);
      else setNote(aiSuggestionsUnavailableMessage(result.aiUnavailableReason));
    } catch (err) {
      setNote(userFacingError(err, 'improve your experience description'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cb-ai-assist">
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <button type="button" className="cb-ai-assist-btn" onClick={() => void improve()} disabled={busy} aria-busy={busy || undefined}>
        {busy ? 'Improving…' : 'Improve with AI'}
      </button>
      {suggestion.length ? (
        <div className="cb-ai-assist-card" role="region" aria-label="AI suggested responsibilities">
          <ul>
            {suggestion.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
          <div className="cb-ai-assist-actions">
            <button
              type="button"
              className="cb-ai-assist-use"
              onClick={() => {
                onUse(suggestion);
                setSuggestion([]);
              }}
            >
              Use these bullets
            </button>
            <button type="button" className="cb-ai-assist-dismiss" onClick={() => setSuggestion([])}>
              Keep mine
            </button>
            <button type="button" className="cb-ai-assist-dismiss" onClick={() => void improve(suggestion)} disabled={busy}>
              Try again
            </button>
          </div>
        </div>
      ) : null}
      {note ? (
        <p className="cb-ai-assist-note" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}
