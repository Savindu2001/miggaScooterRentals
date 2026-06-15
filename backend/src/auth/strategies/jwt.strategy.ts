import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  type: 'staff' | 'customer';
  bookingId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') ?? 'change_me',
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.type === 'staff') {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });
      if (!user || !user.isActive) return null;
      return user;
    }

    // Customer token
    if (payload.type === 'customer') {
      return {
        id: payload.sub,
        type: 'customer',
        bookingId: payload.bookingId,
      };
    }

    return null;
  }
}
