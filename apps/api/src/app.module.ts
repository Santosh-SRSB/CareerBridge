import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CandidatesModule } from './candidates/candidates.module';
import { JobsModule } from './jobs/jobs.module';
import { ResumesModule } from './resumes/resumes.module';
import { ApplicationsModule } from './applications/applications.module';
import { InterviewsModule } from './interviews/interviews.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { HumanMocksModule } from './human-mocks/human-mocks.module';
import { MatchingModule } from './matching/matching.module';
import { EmployersModule } from './employers/employers.module';
import { AdminModule } from './admin/admin.module';
import { SkillsModule } from './skills/skills.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { GstModule } from './gst/gst.module';
import { CoursesModule } from './courses/courses.module';
import { AiModule } from './ai/ai.module';
import { SeedService } from './platform/seed.service';
import { HealthController } from './health.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    PrismaModule,
    AuthModule,
    CandidatesModule,
    JobsModule,
    ResumesModule,
    ApplicationsModule,
    InterviewsModule,
    AssessmentsModule,
    HumanMocksModule,
    MatchingModule,
    EmployersModule,
    AdminModule,
    SkillsModule,
    IntelligenceModule,
    GstModule,
    CoursesModule,
    AiModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    SeedService,
  ],
})
export class AppModule {}
