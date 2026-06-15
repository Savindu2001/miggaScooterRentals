import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExtensionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExtensionDto } from './dto/extension.dto';

@Injectable()
export class ExtensionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(bookingId: string, dto: CreateExtensionDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Check no pending extension exists
    const pendingExtension = await this.prisma.bookingExtension.findFirst({
      where: { bookingId, status: ExtensionStatus.PENDING },
    });
    if (pendingExtension) {
      throw new BadRequestException(
        'A pending extension request already exists for this booking',
      );
    }

    return this.prisma.bookingExtension.create({
      data: {
        bookingId,
        requestedUntil: new Date(dto.requestedUntil),
        reason: dto.reason,
        status: ExtensionStatus.PENDING,
      },
      include: { booking: true },
    });
  }

  async findByBooking(bookingId: string) {
    return this.prisma.bookingExtension.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      include: { reviewedBy: { select: { id: true, name: true } } },
    });
  }

  async findAll(params: { status?: ExtensionStatus; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.bookingExtension.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: true,
          reviewedBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.bookingExtension.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async approve(extensionId: string, reviewedById: string) {
    const extension = await this.prisma.bookingExtension.findUnique({
      where: { id: extensionId },
      include: { booking: true },
    });
    if (!extension) throw new NotFoundException('Extension not found');
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException('This extension has already been reviewed');
    }

    const [updatedExtension] = await this.prisma.$transaction([
      this.prisma.bookingExtension.update({
        where: { id: extensionId },
        data: {
          status: ExtensionStatus.APPROVED,
          reviewedById,
          reviewedAt: new Date(),
        },
      }),
      this.prisma.booking.update({
        where: { id: extension.bookingId },
        data: { returnDate: extension.requestedUntil },
      }),
    ]);

    return updatedExtension;
  }

  async reject(extensionId: string, reviewedById: string) {
    const extension = await this.prisma.bookingExtension.findUnique({
      where: { id: extensionId },
    });
    if (!extension) throw new NotFoundException('Extension not found');
    if (extension.status !== ExtensionStatus.PENDING) {
      throw new BadRequestException('This extension has already been reviewed');
    }

    return this.prisma.bookingExtension.update({
      where: { id: extensionId },
      data: {
        status: ExtensionStatus.REJECTED,
        reviewedById,
        reviewedAt: new Date(),
      },
    });
  }
}
