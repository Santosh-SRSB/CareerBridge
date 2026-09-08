import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export type JwtPayload = {
  sub: string;
  role: string;
  phone: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') || 'dev-access-secret',
    });
  }

  async validate(payload: JwtPayload & { typ?: string }) {
    if (payload.typ === 'refresh') {
      return null;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { candidate: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }
    return {
      id: user.id,
      role: user.userType,
      phone: user.phone,
      onboardingCompleted: user.candidate?.onboardingCompleted ?? false,
      dashboardReached: user.candidate?.dashboardReached ?? false,
    };
  }
}
