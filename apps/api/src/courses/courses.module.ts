import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { ImpactClient } from './impact.client';

@Module({
  imports: [PrismaModule],
  controllers: [CoursesController],
  providers: [ImpactClient, CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
