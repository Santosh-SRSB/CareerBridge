export type OnboardingIconName =
  | 'pin'
  | 'briefcase'
  | 'sparkle'
  | 'search'
  | 'check'
  | 'code'
  | 'data'
  | 'headset'
  | 'design'
  | 'engineering'
  | 'shield'
  | 'test'
  | 'marketing'
  | 'people'
  | 'arrow';

/** Ordered keyword rules: the first rule whose keyword appears in the label wins. */
const CATEGORY_ICON_RULES: Array<[string[], OnboardingIconName]> = [
  [['data', 'analytic'], 'data'],
  [['support', 'customer', 'service', 'call'], 'headset'],
  [['design', 'product', 'ui', 'ux', 'creative'], 'design'],
  [['security', 'cyber'], 'shield'],
  [['qa', 'test', 'quality'], 'test'],
  [['marketing', 'media', 'content'], 'marketing'],
  [['sales', 'business development'], 'arrow'],
  [['human', 'hr', 'recruit', 'people', 'admin'], 'people'],
  [['engineer', 'mechanical', 'civil', 'electrical', 'manufactur'], 'engineering'],
  [['tech', 'software', 'developer', 'it ', 'web', 'cloud', 'devops'], 'code'],
];

/** Picks an icon for a job category label from the catalog; unknown labels get the briefcase. */
export function categoryIconName(label: string): OnboardingIconName {
  const text = ` ${label.toLowerCase()} `;
  for (const [keywords, icon] of CATEGORY_ICON_RULES) {
    if (keywords.some((keyword) => (keyword.length <= 3 ? new RegExp(`\\b${keyword.trim()}\\b`).test(text) : text.includes(keyword)))) {
      return icon;
    }
  }
  return 'briefcase';
}
