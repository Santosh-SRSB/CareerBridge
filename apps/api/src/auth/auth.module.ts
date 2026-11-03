import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { EmailService } from './email.service';
import { JwtStrategy } from './jwt.strategy';
import { requireJwtAccessSecret } from './jwt-secrets';
import { ReferralsModule } from '../referrals/referrals.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: requireJwtAccessSecret(config),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES') || '7d' },
      }),
    }),
    forwardRef(() => ReferralsModule),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, EmailService, JwtStrategy],
  exports: [AuthService, EmailService, FirebaseService],
})
export class AuthModule {}
