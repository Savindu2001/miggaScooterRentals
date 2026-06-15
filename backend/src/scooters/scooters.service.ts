import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ScooterStatus, BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScooterDto } from './dto/create-scooter.dto';
import { UpdateScooterDto } from './dto/update-scooter.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ScootersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScooterDto, imageFiles: Express.Multer.File[] = []) {
    const existing = await this.prisma.scooter.findFirst({
      where: {
        OR: [
          { scooterCode: dto.scooterCode },
          { plateNumber: dto.plateNumber },
        ],
      },
    });
    if (existing) {
      throw new ConflictException('Scooter code or plate number already exists');
    }

    const images = imageFiles.map((f) => `/uploads/scooters/${f.filename}`);

    const scooter = await this.prisma.scooter.create({
      data: {
        scooterCode: dto.scooterCode,
        title: dto.title,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        color: dto.color,
        plateNumber: dto.plateNumber,
        dailyRate: dto.dailyRate,
        weeklyRate: dto.weeklyRate,
        monthlyRate: dto.monthlyRate,
        status: dto.status ?? ScooterStatus.AVAILABLE,
        description: dto.description,
        images,
      },
    });

    return scooter;
  }

  async findAll(params: {
    status?: ScooterStatus;
    search?: string;
    page?: number;
    limit?: number;
    pickupDate?: string;
    returnDate?: string;
  }) {
    const { status, search, page = 1, limit = 20, pickupDate, returnDate } = params;
    const skip = (page - 1) * limit;

    const where: any = { isDeleted: false };
    if (status) where.status = status;
    
    if (pickupDate && returnDate) {
      const start = new Date(pickupDate);
      const end = new Date(returnDate);
      
      const overlappingBookings = await this.prisma.booking.findMany({
        where: {
          bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.RETURNED] },
          pickupDate: { lte: end },
          returnDate: { gte: start },
        },
        select: { scooterId: true },
      });
      
      const overlappingScooterIds = overlappingBookings.map((b) => b.scooterId);
      if (overlappingScooterIds.length > 0) {
        where.id = { notIn: overlappingScooterIds };
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { scooterCode: { contains: search, mode: 'insensitive' } },
        { plateNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.scooter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.scooter.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkAvailability(id: string, pickupDate: string, returnDate: string) {
    const scooter = await this.prisma.scooter.findFirst({
      where: { id, isDeleted: false },
    });
    if (!scooter) throw new NotFoundException(`Scooter ${id} not found`);

    if (scooter.status === ScooterStatus.MAINTENANCE) {
      return { available: false, reason: 'MAINTENANCE' };
    }

    const start = new Date(pickupDate);
    const end = new Date(returnDate);

    const overlapping = await this.prisma.booking.findFirst({
      where: {
        scooterId: id,
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.RETURNED] },
        pickupDate: { lte: end },
        returnDate: { gte: start },
      },
    });

    return {
      available: !overlapping,
      reason: overlapping ? 'BOOKED' : null,
    };
  }

  async findOne(id: string) {
    const scooter = await this.prisma.scooter.findFirst({
      where: { id, isDeleted: false },
    });
    if (!scooter) throw new NotFoundException(`Scooter ${id} not found`);
    return scooter;
  }

  async update(
    id: string,
    dto: UpdateScooterDto,
    imageFiles: Express.Multer.File[] = [],
  ) {
    const scooter = await this.findOne(id);
    const data: any = { ...dto };

    if (imageFiles.length > 0) {
      const newImages = imageFiles.map((f) => `/uploads/scooters/${f.filename}`);
      const existingImages = Array.isArray(scooter.images) ? (scooter.images as string[]) : [];
      data.images = [...existingImages, ...newImages];
    }

    return this.prisma.scooter.update({ where: { id }, data });
  }

  async updateStatus(id: string, status: ScooterStatus) {
    await this.findOne(id);
    return this.prisma.scooter.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.scooter.update({
      where: { id },
      data: { isDeleted: true },
    });
    return { message: 'Scooter deleted successfully' };
  }

  async removeImage(id: string, imageUrl: string) {
    const scooter = await this.findOne(id);
    const images = Array.isArray(scooter.images) ? (scooter.images as string[]) : [];
    const updated = images.filter((img) => img !== imageUrl);

    // Delete physical file
    const filePath = path.join(process.cwd(), imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return this.prisma.scooter.update({
      where: { id },
      data: { images: updated },
    });
  }
}
