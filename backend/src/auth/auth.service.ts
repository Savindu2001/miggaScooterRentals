import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CustomerAccessDto } from './dto/customer-access.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'staff',
    };

    const token = this.jwtService.sign(payload);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async customerAccess(dto: CustomerAccessDto) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingId: dto.bookingId,
        passportNumber: dto.passportNumber,
      },
      include: { scooter: true },
    });

    if (!booking) {
      throw new NotFoundException(
        'Booking not found. Please check your booking ID and passport number.',
      );
    }

    const payload = {
      sub: booking.id,
      bookingId: booking.bookingId,
      type: 'customer',
    };

    const token = this.jwtService.sign(payload, {
      expiresIn: (
        this.configService.get<string>('jwt.customerExpiresIn') ?? '24h'
      ) as any,
    });

    return {
      accessToken: token,
      booking: {
        id: booking.id,
        bookingId: booking.bookingId,
        customerName: booking.customerName,
        bookingStatus: booking.bookingStatus,
        pickupDate: booking.pickupDate,
        returnDate: booking.returnDate,
        scooter: {
          title: booking.scooter.title,
          brand: booking.scooter.brand,
          model: booking.scooter.model,
        },
      },
    };
  }
}
