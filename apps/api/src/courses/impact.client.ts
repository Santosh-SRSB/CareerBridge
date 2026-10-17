import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ImpactCatalogItem = {
  Id?: string;
  CatalogItemId?: string;
  CatalogId?: string;
  Name?: string;
  Description?: string;
  Manufacturer?: string;
  Url?: string;
  MobileUrl?: string;
  ImageUrl?: string;
  AdditionalImageUrls?: string[];
  CurrentPrice?: string;
  OriginalPrice?: string;
  Currency?: string;
  Category?: string;
  CampaignName?: string;
  Labels?: string[];
  Text1?: string;
  Text2?: string;
  Text3?: string;
  Bullets?: string[];
};

type ImpactSearchResponse = {
  Items?: ImpactCatalogItem[];
};

@Injectable()
export class ImpactClient {
  private readonly logger = new Logger(ImpactClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(this.config.get<string>('IMPACT_ACCOUNT_SID')?.trim() && this.config.get<string>('IMPACT_AUTH_TOKEN')?.trim());
  }

  private authHeader() {
    const sid = this.config.get<string>('IMPACT_ACCOUNT_SID')?.trim() ?? '';
    const token = this.config.get<string>('IMPACT_AUTH_TOKEN')?.trim() ?? '';
    return `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`;
  }

  private baseUrl() {
    const sid = this.config.get<string>('IMPACT_ACCOUNT_SID')?.trim() ?? '';
    const root = (this.config.get<string>('IMPACT_API_BASE')?.trim() || 'https://api.impact.com').replace(/\/$/, '');
    return `${root}/Mediapartners/${sid}`;
  }

  async searchItems(keyword: string, pageSize = 12): Promise<ImpactCatalogItem[]> {
    if (!this.isConfigured()) return [];

    const catalogId = this.config.get<string>('IMPACT_CATALOG_ID')?.trim();
    // Keyword search across catalogs (Udemy catalog has 300k+ items — do not page dump it)
    const url = `${this.baseUrl()}/Catalogs/ItemSearch?Keyword=${encodeURIComponent(keyword)}&PageSize=${pageSize}&Page=1`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader(),
        },
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Impact search failed (${res.status}) for "${keyword}": ${body.slice(0, 180)}`);
        return [];
      }

      const data = (await res.json()) as ImpactSearchResponse;
      let items = Array.isArray(data.Items) ? data.Items : [];

      if (catalogId) {
        const scoped = items.filter((item) => String(item.CatalogId ?? '') === catalogId);
        if (scoped.length) items = scoped;
      }

      return items;
    } catch (err) {
      this.logger.warn(`Impact search error for "${keyword}": ${(err as Error).message}`);
      return [];
    }
  }

  async listCatalogs() {
    if (!this.isConfigured()) return [];
    try {
      const res = await fetch(`${this.baseUrl()}/Catalogs`, {
        headers: {
          Accept: 'application/json',
          Authorization: this.authHeader(),
        },
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { Catalogs?: unknown[] };
      return Array.isArray(data.Catalogs) ? data.Catalogs : [];
    } catch {
      return [];
    }
  }
}
