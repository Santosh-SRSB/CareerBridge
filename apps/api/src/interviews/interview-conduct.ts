export type ConductKind = 'abuse' | 'nonsense';

/** Catch vulgar / abusive language, including speech-to-text variants. */
const ABUSE_RE =
  /\b(mother\s*f+u+c+k+(?:er|ing)?|motha\s*f+u+c+k+(?:er)?|mofo|mf+er|f+u+c+k+(?:er|ing|ed)?|f+u+k+(?:ing|er)?|fck(?:ing)?|f\*+k(?:ing)?|shit(?:ty|head)?|bitch(?:es)?|asshole|a+ss\s*hole|bastard|damn\s+you|dick(?:head)?|pussy|cunt|whore|slut|retard(?:ed)?|idiot\s+interviewer|stupid\s+ai|shut\s*up|go\s+to\s+hell|kill\s+yourself|kys)\b|(?:^|\s)(chutiya|chutiye|madarchod|behenchod|bhenchod|mc\b|bc\b|gandu|randi|saala|bsdk|lund|bhosdike|bhosdi|harami|kutta|kutte|ullu|gaandu|madar\s*chod)(?:\s|$)/i;

const BLAH_RE = /\b(bla+h?\s*){2,}\b|\b(bla\s+){2,}bla\b/i;

export function detectConduct(text: string): ConductKind | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return 'nonsense';
  const n = raw.toLowerCase();

  if (ABUSE_RE.test(n)) return 'abuse';
  // Speech engines sometimes soften swears; still treat clear hostility + filler as abuse-adjacent nonsense,
  // but if filler is only blah with an insult fragment, abuse regex above should catch it.

  if (raw.length < 6) return 'nonsense';
  if (/^(.)\1{4,}$/.test(n.replace(/\s/g, ''))) return 'nonsense';
  if (BLAH_RE.test(n) && n.split(/\s+/).length <= 8) return 'nonsense';
  if (/^(asdf|qwerty|blah+|bla+|test+|hello+|hi+|ok+|yes+|no+|haha+|hehe+|idk|nothing|random|xyz+|abc+)\.?$/i.test(n)) {
    return 'nonsense';
  }
  if (/^(i don'?t know|no idea|whatever|don'?t care|skip|next question)\.?$/i.test(n)) return 'nonsense';

  const words = n.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && raw.length < 18) {
    const hasSignal =
      /\b(i|am|my|work|project|team|role|java|react|node|sql|html|css|year|experience|company|built|used|learn|skill)\b/i.test(
        n,
      );
    if (!hasSignal) return 'nonsense';
  }

  const unique = new Set(words);
  if (words.length >= 4 && unique.size <= 2) return 'nonsense';

  return null;
}

/** Max warnings before the next offense ends the interview (3 strikes). */
export const CONDUCT_MAX_WARNINGS = 2;

export function conductWarningMessage(kind: ConductKind, strike: number) {
  if (kind === 'abuse') {
    if (strike <= 1) {
      return 'Please do not use vulgar or abusive language. Answer the question appropriately and professionally. This is warning one of three.';
    }
    return 'Abusive language is not acceptable in this interview. Answer properly and stay professional. This is your final warning. One more abusive answer will end this interview.';
  }
  if (strike <= 1) {
    return 'That answer was not meaningful. Please answer the question properly. This is warning one of three.';
  }
  return 'Random or meaningless answers are not acceptable. Answer the question clearly. This is your final warning. One more will end this interview.';
}

export function conductTerminateMessage(kind: ConductKind) {
  if (kind === 'abuse') {
    return 'This interview is ending because of repeated abusive language. Please stay professional in future interviews.';
  }
  return 'This interview is ending because of repeated meaningless answers. Please answer seriously in future interviews.';
}

export function countConductWarnings(
  warnings: Array<{ type: string }>,
  kind?: ConductKind,
): number {
  if (kind === 'abuse') return warnings.filter((item) => item.type === 'ABUSE').length;
  if (kind === 'nonsense') return warnings.filter((item) => item.type === 'NONSENSE').length;
  return warnings.filter((item) => item.type === 'ABUSE' || item.type === 'NONSENSE').length;
}
