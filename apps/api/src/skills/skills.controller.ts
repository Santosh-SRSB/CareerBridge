import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('skills')
@Controller('skills')
export class SkillsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list(@Query('query') query?: string) {
    const q = query?.trim();
    return this.prisma.skill.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { aliases: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  @Public()
  @Get('categories')
  async categories() {
    const skills = await this.prisma.skill.findMany({ where: { active: true } });
    const grouped = new Map<string, string[]>();
    for (const skill of skills) {
      const list = grouped.get(skill.category) || [];
      list.push(skill.name);
      grouped.set(skill.category, list);
    }
    return Array.from(grouped.entries()).map(([category, names]) => ({ category, names }));
  }
}
