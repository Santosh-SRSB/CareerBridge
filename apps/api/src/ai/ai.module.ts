import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { AiGatewayService } from './ai-gateway.service';
import { VectorStoreService } from './vector-store.service';
import { DocumentIndexService } from './document-index.service';
import { RagRetrievalService } from './rag-retrieval.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [
    GeminiProvider,
    VectorStoreService,
    AiGatewayService,
    DocumentIndexService,
    RagRetrievalService,
  ],
  exports: [AiGatewayService, GeminiProvider, DocumentIndexService, RagRetrievalService, VectorStoreService],
})
export class AiModule {}
