import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseService } from './firebase.service';
import { EmailService } from './email.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret',
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES') || '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FirebaseService, EmailService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
