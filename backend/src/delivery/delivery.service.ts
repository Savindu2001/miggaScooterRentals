import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto';

@Injectable()
export class DeliveryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({ data: dto });
  }

  async findAll() {
    return this.prisma.deliveryZone.findMany({ orderBy: { distanceKm: 'asc' } });
  }

  async findOne(id: string) {
    const zone = await this.prisma.deliveryZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException(`Delivery zone ${id} not found`);
    return zone;
  }

  async update(id: string, dto: UpdateDeliveryZoneDto) {
    await this.findOne(id);
    return this.prisma.deliveryZone.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.deliveryZone.delete({ where: { id } });
    return { message: 'Delivery zone deleted' };
  }
}
