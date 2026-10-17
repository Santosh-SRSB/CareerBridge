import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ImpactCatalogItem, ImpactClient } from './impact.client';
import { RecommendedCourse } from './courses.types';

type FallbackCourse = Omit<RecommendedCourse, 'matchedSkill' | 'source'>;

const FALLBACK_BY_SKILL: Record<string, FallbackCourse[]> = {
  sql: [
    {
      id: 'fb-sql',
      title: 'SQL for Data Analysis',
      provider: 'Udemy',
      instructor: null,
      level: 'Beginner',
      duration: 'Self-paced',
      blurb: 'Queries, joins, and dashboards for workplace data tasks.',
      imageUrl: 'https://img-c.udemycdn.com/course/480x270/567828_67d0.jpg',
      instructorImageUrl: null,
      priceLabel: 'See on Udemy',
      strikeLabel: null,
      currency: null,
      url: 'https://www.udemy.com/courses/search/?q=sql%20for%20data%20analysis',
    },
  ],
  python: [
    {
      id: 'fb-python',
      title: 'Python for Automation',
      provider: 'Udemy',
      instructor: null,
      level: 'Intermediate',
      duration: 'Self-paced',
      blurb: 'Scripts and automation that strengthen your project proof.',
      imageUrl: 'https://img-c.udemycdn.com/course/480x270/567828_67d0.jpg',
      instructorImageUrl: null,
      priceLabel: 'See on Udemy',
      strikeLabel: null,
      currency: null,
      url: 'https://www.udemy.com/courses/search/?q=python%20automation',
    },
  ],
  react: [
    {
      id: 'fb-react',
      title: 'React Essentials',
      provider: 'Udemy',
      instructor: null,
      level: 'Intermediate',
      duration: 'Self-paced',
      blurb: 'Hooks, components, and patterns recruiters look for.',
      imageUrl: 'https://img-c.udemycdn.com/course/480x270/1362070_b9a1_2.jpg',
      instructorImageUrl: null,
      priceLabel: 'See on Udemy',
      strikeLabel: null,
      currency: null,
      url: 'https://www.udemy.com/courses/search/?q=react%20essentials',
    },
  ],
  default: [
    {
      id: 'fb-cloud',
      title: 'Cloud Computing Fundamentals',
      provider: 'Udemy',
      instructor: null,
      level: 'Beginner',
      duration: 'Self-paced',
      blurb: 'Core cloud concepts to broaden your technology stack.',
      imageUrl: 'https://img-c.udemycdn.com/course/480x270/3142166_a637_2.jpg',
      instructorImageUrl: null,
      priceLabel: 'See on Udemy',
      strikeLabel: null,
      currency: null,
      url: 'https://www.udemy.com/courses/search/?q=cloud%20computing',
    },
    {
      id: 'fb-sysdesign',
      title: 'System Design for Beginners',
      provider: 'Udemy',
      instructor: null,
      level: 'Beginner',
      duration: 'Self-paced',
      blurb: 'Scalability and interview-style design questions.',
      imageUrl: 'https://img-c.udemycdn.com/course/480x270/3093204_c1e6.jpg',
      instructorImageUrl: null,
      priceLabel: 'See on Udemy',
      strikeLabel: null,
      currency: null,
      url: 'https://www.udemy.com/courses/search/?q=system%20design',
    },
  ],
};

function looksLikeImageUrl(value?: string | null) {
  if (!value) return false;
  return /^https?:\/\//i.test(value) && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value);
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly impact: ImpactClient,
  ) {}

  async recommendationsForUser(userId: string, limit = 12) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { userId },
      include: {
        skills: true,
        experiences: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    const skillNames = (candidate?.skills ?? [])
      .map((s) => s.name?.trim())
      .filter(Boolean) as string[];

    const experienceHints = (candidate?.experiences ?? [])
      .flatMap((e) => [e.jobTitle, e.company].filter(Boolean) as string[])
      .slice(0, 4);

    const queryTerms = [...new Set([...skillNames, ...experienceHints])].slice(0, 6);
    if (!queryTerms.length) {
      return {
        configured: this.impact.isConfigured(),
        skills: [] as string[],
        items: this.fallbackCourses(['default'], limit),
      };
    }

    const impactItems: RecommendedCourse[] = [];
    if (this.impact.isConfigured()) {
      for (const term of queryTerms.slice(0, 4)) {
        const found = await this.impact.searchItems(term, 10);
        for (const item of found) {
          const mapped = this.mapImpactItem(item, term);
          if (!mapped) continue;
          if (impactItems.some((x) => x.id === mapped.id || x.title === mapped.title)) continue;
          impactItems.push(mapped);
          if (impactItems.length >= limit) break;
        }
        if (impactItems.length >= limit) break;
      }
    }

    if (impactItems.length > 0) {
      return {
        configured: true,
        skills: skillNames,
        items: impactItems.slice(0, limit),
      };
    }

    return {
      configured: this.impact.isConfigured(),
      skills: skillNames,
      items: this.fallbackCourses(skillNames.length ? skillNames : ['default'], limit),
    };
  }

  private mapImpactItem(item: ImpactCatalogItem, matchedSkill: string): RecommendedCourse | null {
    const title = item.Name?.trim();
    if (!title) return null;
    const id = item.Id || item.CatalogItemId || title.toLowerCase().replace(/\s+/g, '-');
    const current = item.CurrentPrice?.trim() || null;
    const original = item.OriginalPrice?.trim() || null;
    const currency = item.Currency?.trim() || null;
    const priceLabel = current
      ? `${currency === 'USD' ? '$' : currency && currency !== 'USD' ? `${currency} ` : ''}${current}`
      : 'See on Udemy';
    const strikeLabel = original && original !== current ? `${currency === 'USD' ? '$' : ''}${original}` : null;

    const extras = [item.Text1, item.Text2, item.Text3, ...(item.Bullets ?? [])].filter(Boolean) as string[];
    const instructor =
      extras.find((v) => !looksLikeImageUrl(v) && /instructor|teacher|by\s+/i.test(v)) ||
      extras.find((v) => !looksLikeImageUrl(v) && v.length < 80) ||
      item.Manufacturer?.trim() ||
      null;

    const imageUrl = item.ImageUrl?.trim() || null;
    const instructorImageUrl =
      (item.AdditionalImageUrls ?? []).find((u) => looksLikeImageUrl(u)) ||
      extras.find((v) => looksLikeImageUrl(v)) ||
      null;

    return {
      id: String(id),
      title,
      provider: item.CampaignName?.trim() || 'Udemy',
      instructor,
      level: 'All levels',
      duration: 'Self-paced',
      blurb: (item.Description || item.Category || `Recommended for your ${matchedSkill} skills.`).slice(0, 180),
      imageUrl,
      instructorImageUrl,
      priceLabel,
      strikeLabel,
      currency,
      url: item.Url?.trim() || item.MobileUrl?.trim() || `https://www.udemy.com/courses/search/?q=${encodeURIComponent(matchedSkill)}`,
      matchedSkill,
      source: 'impact',
    };
  }

  private fallbackCourses(skills: string[], limit: number): RecommendedCourse[] {
    const out: RecommendedCourse[] = [];
    for (const skill of skills) {
      const key = skill.toLowerCase();
      const bucket =
        FALLBACK_BY_SKILL[key] ||
        Object.entries(FALLBACK_BY_SKILL).find(([k]) => key.includes(k))?.[1] ||
        FALLBACK_BY_SKILL.default;
      for (const course of bucket) {
        if (out.some((x) => x.id === course.id)) continue;
        out.push({ ...course, matchedSkill: skill, source: 'fallback' });
        if (out.length >= limit) return out;
      }
    }
    return out;
  }
}
