/** Shared SRSB CareerBridge HTML email layout (table-based with inline styles for Gmail, Outlook and mobile clients). */

export const EMAIL_BRAND_NAME = 'SRSB CareerBridge';
export const EMAIL_BRAND_WEBSITE = 'https://www.srsbcareerbridge.com';
/** Official SRSB logo (apps/web/public/srsb-mark.png, 408x170), served by the web app. */
export const EMAIL_LOGO_PATH = '/srsb-mark.png';
export const EMAIL_LOGO_FALLBACK_URL = `${EMAIL_BRAND_WEBSITE}${EMAIL_LOGO_PATH}`;
const LOGO_WIDTH = 144;
const LOGO_HEIGHT = 60;

const FONT = 'Arial, Helvetica, sans-serif';
const INK = '#0c3340';
const MUTED = '#5b6f70';
const BRAND = '#004043';
const ACCENT = '#f7941d';

export function escapeHtml(value: unknown) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string,
  );
}

function isPublicHttpsUrl(raw: string | undefined) {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** EMAIL_LOGO_URL, else the logo on PUBLIC_WEB_URL; anything that is not public HTTPS falls back to the website copy. */
export function resolveEmailLogoUrl(env: { EMAIL_LOGO_URL?: string; PUBLIC_WEB_URL?: string }) {
  const explicit = env.EMAIL_LOGO_URL?.trim();
  if (isPublicHttpsUrl(explicit)) return explicit!;
  const base = env.PUBLIC_WEB_URL?.trim().replace(/\/+$/, '');
  const fromWeb = base ? `${base}${EMAIL_LOGO_PATH}` : undefined;
  return isPublicHttpsUrl(fromWeb) ? fromWeb! : EMAIL_LOGO_FALLBACK_URL;
}

/** Only http(s) links become buttons/links; anything else renders as `#`. */
export function safeHref(raw: string | null | undefined) {
  return raw && /^https?:\/\//i.test(raw.trim()) ? escapeHtml(raw.trim()) : '#';
}

export function emailButton(label: string, href: string | null | undefined) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 16px;"><tr><td bgcolor="${BRAND}" style="border-radius:999px;background-color:${BRAND};"><a href="${safeHref(href)}" target="_blank" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:15px;font-weight:700;line-height:20px;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a></td></tr></table>`;
}

export function emailLink(label: string, href: string | null | undefined) {
  return `<a href="${safeHref(href)}" target="_blank" style="color:#0f766e;text-decoration:underline;">${escapeHtml(label)}</a>`;
}

export function emailParagraph(innerHtml: string, style = '') {
  return `<p style="margin:0 0 14px;${style}">${innerHtml}</p>`;
}

export function emailNote(innerHtml: string) {
  return emailParagraph(innerHtml, `color:${MUTED};font-size:13px;`);
}

export function renderBrandedEmail(input: {
  title: string;
  bodyHtml: string;
  logoUrl: string;
  supportEmail?: string | null;
  preheader?: string;
}) {
  const support = input.supportEmail?.trim();
  const supportLine = support
    ? `<br>Questions? Email <a href="mailto:${escapeHtml(support)}" style="color:#0f766e;text-decoration:underline;">${escapeHtml(support)}</a>`
    : '';
  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#ffffff;opacity:0;">${escapeHtml(input.preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6f6;">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f6f6;">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #dfe7e7;border-radius:12px;">
<tr><td style="padding:22px 28px 16px;border-bottom:3px solid ${ACCENT};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${escapeHtml(input.logoUrl)}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="${EMAIL_BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;width:${LOGO_WIDTH}px;max-width:${LOGO_WIDTH}px;height:auto;"></td>
<td style="vertical-align:middle;padding-left:12px;font-family:${FONT};font-size:18px;font-weight:700;color:${BRAND};">CareerBridge</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 28px 10px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK};">
${input.bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px 22px;border-top:1px solid #e6eded;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
${EMAIL_BRAND_NAME} &middot; <a href="${EMAIL_BRAND_WEBSITE}" target="_blank" style="color:#0f766e;text-decoration:underline;">www.srsbcareerbridge.com</a>${supportLine}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
