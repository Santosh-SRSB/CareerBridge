import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ParseResumePipeline } from './parse-resume.pipeline';

class ParseResumeTextDto {
  @IsOptional()
  @IsString()
  rawText?: string;
}

/**
 * POST /api/v1/parse-resume
 * Accepts multipart file and/or JSON { rawText }.
 * Returns strict ParsedResumeSchema with fallback on partial/malformed output.
 */
@ApiTags('parse-resume')
@Controller('parse-resume')
export class ParseResumeController {
  constructor(private readonly pipeline: ParseResumePipeline) {}

  @Public()
  @Post()
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        rawText: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async parse(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body() body: ParseResumeTextDto,
    @CurrentUser() user?: { id: string },
  ) {
    const rawText = (body?.rawText || '').trim();
    if (!file?.buffer?.length && !rawText) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Provide a resume file or rawText.',
      });
    }

    const result = await this.pipeline.parse({
      buffer: file?.buffer,
      mimeType: file?.mimetype,
      fileName: file?.originalname,
      rawText: rawText || undefined,
      userId: user?.id,
    });

    // Always return schema (even partial) — clients use meta.partial / ok / error
    return {
      success: result.ok,
      data: result.data,
      meta: result.meta,
      rawTextPreview: result.rawTextPreview,
      ...(result.error ? { error: result.error } : {}),
    };
  }

  /** Authenticated variant — same behavior, attaches userId for AI audit. */
  @ApiBearerAuth()
  @Post('authenticated')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async parseAuthenticated(
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined,
    @Body() body: ParseResumeTextDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.parse(file, body, user);
  }
}
