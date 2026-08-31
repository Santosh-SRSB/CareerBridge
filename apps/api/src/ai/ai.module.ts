import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { AiGatewayService } from './ai-gateway.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [GeminiProvider, OpenAIProvider, AiGatewayService],
  exports: [AiGatewayService, GeminiProvider, OpenAIProvider],
})
export class AiModule {}
