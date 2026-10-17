import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PiiCryptoService } from './pii-crypto.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PiiCryptoService],
  exports: [PiiCryptoService],
})
export class PiiCryptoModule {}
