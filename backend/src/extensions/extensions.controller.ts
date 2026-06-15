import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExtensionStatus, Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateExtensionDto } from './dto/extension.dto';
import { ExtensionsService } from './extensions.service';

@ApiTags('Booking Extensions')
@ApiBearerAuth()
@Controller('extensions')
export class ExtensionsController {
  constructor(private readonly extensionsService: ExtensionsService) {}

  @Public()
  @Post('booking/:bookingId')
  @ApiOperation({ summary: 'Request a booking extension (customer or staff)' })
  create(
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateExtensionDto,
  ) {
    return this.extensionsService.create(bookingId, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List all extension requests' })
  @ApiQuery({ name: 'status', required: false, enum: ExtensionStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('status') status?: ExtensionStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.extensionsService.findAll({ status, page, limit });
  }

  @Public()
  @Get('booking/:bookingId')
  @ApiOperation({ summary: 'Get extensions for a specific booking' })
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.extensionsService.findByBooking(bookingId);
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Approve an extension request — updates booking return date' })
  approve(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.extensionsService.approve(id, userId);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Reject an extension request' })
  reject(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.extensionsService.reject(id, userId);
  }
}
