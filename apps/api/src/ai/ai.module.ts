import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { AiGatewayService } from './ai-gateway.service';
import { VectorStoreService } from './vector-store.service';
import { DocumentIndexService } from './document-index.service';
import { RagRetrievalService } from './rag-retrieval.service';
import { TtsService } from './tts.service';
import { TtsController } from './tts.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [TtsController],
  providers: [
    GeminiProvider,
    VectorStoreService,
    AiGatewayService,
    DocumentIndexService,
    RagRetrievalService,
    TtsService,
  ],
  exports: [
    AiGatewayService,
    GeminiProvider,
    DocumentIndexService,
    RagRetrievalService,
    VectorStoreService,
    TtsService,
  ],
})
export class AiModule {}
