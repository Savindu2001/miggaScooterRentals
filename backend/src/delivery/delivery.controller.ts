import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateDeliveryZoneDto, UpdateDeliveryZoneDto } from './dto/delivery-zone.dto';
import { DeliveryService } from './delivery.service';

@ApiTags('Delivery Zones')
@ApiBearerAuth()
@Controller('delivery/zones')
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a delivery zone (Admin only)' })
  create(@Body() dto: CreateDeliveryZoneDto) {
    return this.deliveryService.create(dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all delivery zones sorted by distance' })
  findAll() {
    return this.deliveryService.findAll();
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get a delivery zone by ID' })
  findOne(@Param('id') id: string) {
    return this.deliveryService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a delivery zone (Admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateDeliveryZoneDto) {
    return this.deliveryService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a delivery zone (Admin only)' })
  remove(@Param('id') id: string) {
    return this.deliveryService.remove(id);
  }
}
