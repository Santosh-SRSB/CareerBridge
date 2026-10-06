import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { ErrorCode, catalogKindFromSlug, type CatalogKind } from '@careerbridge/shared';
import { UserType } from '../prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationsService } from '../notifications/notifications.service';
import { CatalogService } from './catalog.service';

class CreateCatalogItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  parentValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class UpdateCatalogItemDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  parentValue?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

class NotificationTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  body: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

function kindOrThrow(slug: string): CatalogKind {
  const kind = catalogKindFromSlug(slug);
  if (!kind) {
    throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Unknown settings list.' });
  }
  return kind;
}

@ApiTags('catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Public()
  @Get(':slug')
  list(@Param('slug') slug: string, @Query('parent') parent?: string) {
    return this.catalog.list(kindOrThrow(slug), { parentValue: parent?.trim() || undefined });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserType.SUPER_ADMIN)
@Controller('admin')
export class CatalogAdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get('catalog/:slug')
  list(@Param('slug') slug: string) {
    return this.catalog.list(kindOrThrow(slug), { includeInactive: true });
  }

  @Post('catalog/:slug')
  create(@CurrentUser() user: { id: string }, @Param('slug') slug: string, @Body() dto: CreateCatalogItemDto) {
    return this.catalog.create(user.id, kindOrThrow(slug), dto);
  }

  @Patch('catalog/:slug/:id')
  update(
    @CurrentUser() user: { id: string },
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
  ) {
    return this.catalog.update(user.id, kindOrThrow(slug), id, dto as { label: string });
  }

  @Delete('catalog/:slug/:id')
  remove(@CurrentUser() user: { id: string }, @Param('slug') slug: string, @Param('id') id: string) {
    return this.catalog.remove(user.id, kindOrThrow(slug), id);
  }

  @Get('notification-templates')
  templates() {
    return this.notifications.listTemplates();
  }

  @Put('notification-templates/:key')
  updateTemplate(
    @CurrentUser() user: { id: string },
    @Param('key') key: string,
    @Body() dto: NotificationTemplateDto,
  ) {
    return this.notifications.updateTemplate(user.id, key, dto);
  }

  @Delete('notification-templates/:key')
  resetTemplate(@CurrentUser() user: { id: string }, @Param('key') key: string) {
    return this.notifications.resetTemplate(user.id, key);
  }
}
