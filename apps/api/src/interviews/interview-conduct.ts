export type ConductKind = 'abuse' | 'nonsense';

const ABUSE_RE =
  /\b(fuck|fucking|shit|bitch|asshole|bastard|damn you|dick|pussy|cunt|whore|slut|retard|idiot interviewer|stupid ai|shut up)\b|(?:^|\s)(chutiya|chutiye|madarchod|behenchod|mc\b|bc\b|gandu|randi|saala|bsdk|lund|bhosdike|harami|kutta|kutte|ullu)(?:\s|$)/i;

export function detectConduct(text: string): ConductKind | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return 'nonsense';
  const n = raw.toLowerCase();

  if (ABUSE_RE.test(n)) return 'abuse';

  if (raw.length < 6) return 'nonsense';
  if (/^(.)\1{4,}$/.test(n.replace(/\s/g, ''))) return 'nonsense';
  if (/^(asdf|qwerty|blah+|test+|hello+|hi+|ok+|yes+|no+|haha+|hehe+|idk|nothing|random|xyz+|abc+)\.?$/i.test(n)) {
    return 'nonsense';
  }
  if (/^(i don'?t know|no idea|whatever|don'?t care|skip|next question)\.?$/i.test(n)) return 'nonsense';

  const words = n.split(/\s+/).filter(Boolean);
  if (words.length <= 2 && raw.length < 18) {
    const hasSignal = /\b(i|am|my|work|project|team|role|java|react|node|sql|html|css|year|experience|company|built|used|learn|skill)\b/i.test(n);
    if (!hasSignal) return 'nonsense';
  }

  const unique = new Set(words);
  if (words.length >= 4 && unique.size <= 2) return 'nonsense';

  return null;
}

export function conductWarningMessage(kind: ConductKind) {
  if (kind === 'abuse') {
    return 'Abusive language will terminate this interview. This is your only warning. Please stay professional.';
  }
  return 'Random or meaningless answers will terminate this interview. This is your only warning. Please answer properly.';
}
