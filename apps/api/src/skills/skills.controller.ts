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
    return this.prisma.skill.findMany({
      where: query ? { name: { contains: query, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  @Public()
  @Get('categories')
  async categories() {
    const skills = await this.prisma.skill.findMany();
    const grouped = new Map<string, string[]>();
    for (const skill of skills) {
      const list = grouped.get(skill.category) || [];
      list.push(skill.name);
      grouped.set(skill.category, list);
    }
    return Array.from(grouped.entries()).map(([category, names]) => ({ category, names }));
  }
}
