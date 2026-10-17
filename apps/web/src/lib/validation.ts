export const VALID_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'co', 'io', 'ai', 'in',
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
  'uk', 'co.uk', 'ca', 'au', 'com.au', 'de', 'fr', 'jp', 'cn', 'sg', 'ae', 'sa',
  'tech', 'info', 'biz', 'dev', 'app', 'online', 'site', 'store', 'cloud', 'me', 'tv'
]);

export function validateEmailAddress(value: string, required = true): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return required ? 'Email address is required.' : null;
  }

  // 1. Basic format & length checks
  if (trimmed.length > 254) {
    return 'Email address is too long (maximum 254 characters).';
  }

  if (trimmed.includes(' ')) {
    return 'Email address cannot contain spaces.';
  }

  const atParts = trimmed.split('@');
  if (atParts.length === 1) {
    return 'Email must include "@" symbol (e.g. name@gmail.com).';
  }
  if (atParts.length > 2) {
    return 'Email address can only contain one "@" symbol.';
  }

  const [username, domain] = atParts;

  // 2. Local part (username) validation
  if (!username) {
    return 'Enter the username part before "@" in email.';
  }
  if (username.length < 2) {
    return 'Email username must be at least 2 characters.';
  }
  if (username.length > 64) {
    return 'Email username is too long (maximum 64 characters).';
  }
  if (!/^[a-z0-9]+([._%+-][a-z0-9]+)*$/.test(username)) {
    return 'Email username contains invalid characters or consecutive dots.';
  }

  // 3. Domain part validation
  if (!domain) {
    return 'Enter the domain name after "@" (e.g. gmail.com).';
  }
  if (domain.length < 4) {
    return 'Enter a valid domain name (e.g. gmail.com).';
  }
  if (!domain.includes('.')) {
    return 'Domain must include a dot (e.g. gmail.com).';
  }
  if (domain.startsWith('.') || domain.endsWith('.')) {
    return 'Domain cannot start or end with a dot.';
  }
  if (domain.includes('..')) {
    return 'Domain cannot contain consecutive dots.';
  }

  const domainParts = domain.split('.');
  const domainName = domainParts[0];

  if (!domainName || domainName.length < 2) {
    return 'Domain name is too short (e.g. "gmail" in gmail.com).';
  }
  if (!/^[a-z0-9-]+$/.test(domainName) || domainName.startsWith('-') || domainName.endsWith('-')) {
    return 'Domain name contains invalid characters.';
  }

  const lastTld = domainParts[domainParts.length - 1];
  if (!lastTld || lastTld.length < 2) {
    return 'Domain extension (e.g. .com) is too short.';
  }
  if (!/^[a-z]+$/.test(lastTld)) {
    return 'Domain extension can only contain letters.';
  }

  return null;
}
