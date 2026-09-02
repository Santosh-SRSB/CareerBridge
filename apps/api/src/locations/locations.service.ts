import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  listActiveStates() {
    return this.prisma.state.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  listActiveCities(stateId?: string) {
    return this.prisma.city.findMany({
      where: {
        active: true,
        ...(stateId ? { stateId } : {}),
        state: { active: true },
      },
      select: {
        id: true,
        name: true,
        stateId: true,
        state: { select: { id: true, name: true, code: true } },
      },
      orderBy: { name: 'asc' },
    });
  }
}
