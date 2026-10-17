export type RecommendedCourse = {
  id: string;
  title: string;
  provider: string;
  instructor: string | null;
  level: string;
  duration: string;
  blurb: string;
  imageUrl: string | null;
  instructorImageUrl: string | null;
  priceLabel: string;
  strikeLabel: string | null;
  currency: string | null;
  url: string;
  matchedSkill: string;
  source: 'impact' | 'fallback';
};
