import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { INDIA_STATE_ROWS } from './india-locations.data';

@Injectable()
export class LocationsService {
  constructor(private readonly catalog: CatalogService) {}

  listActiveStates() {
    return Promise.resolve(INDIA_STATE_ROWS);
  }

  /** Cities are admin-managed (Admin → Settings → Locations). */
  async listActiveCities(stateId?: string) {
    const rows = await this.catalog.list('LOCATION_CITY', { parentValue: stateId || undefined });
    return rows.map((row) => ({
      id: row.value,
      name: row.label,
      stateId: row.parentValue ?? '',
      state: INDIA_STATE_ROWS.find((state) => state.id === row.parentValue) ?? null,
    }));
  }
}
