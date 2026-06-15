import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, ScooterStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { scooterImageStorage } from '../uploads/multer.config';
import { CreateScooterDto } from './dto/create-scooter.dto';
import { UpdateScooterDto, UpdateScooterStatusDto } from './dto/update-scooter.dto';
import { ScootersService } from './scooters.service';

@ApiTags('Scooters')
@ApiBearerAuth()
@Controller('scooters')
export class ScootersController {
  constructor(private readonly scootersService: ScootersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FilesInterceptor('images', 10, scooterImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new scooter with optional images' })
  create(
    @Body() dto: CreateScooterDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.scootersService.create(dto, files);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List all scooters with pagination and filters' })
  @ApiQuery({ name: 'status', required: false, enum: ScooterStatus })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'pickupDate', required: false, type: String })
  @ApiQuery({ name: 'returnDate', required: false, type: String })
  findAll(
    @Query('status') status?: ScooterStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('pickupDate') pickupDate?: string,
    @Query('returnDate') returnDate?: string,
  ) {
    return this.scootersService.findAll({ status, search, page, limit, pickupDate, returnDate });
  }

  @Public()
  @Get(':id/availability')
  @ApiOperation({ summary: 'Check if a specific scooter is available for a date range' })
  @ApiQuery({ name: 'pickupDate', type: String })
  @ApiQuery({ name: 'returnDate', type: String })
  checkAvailability(
    @Param('id') id: string,
    @Query('pickupDate') pickupDate: string,
    @Query('returnDate') returnDate: string,
  ) {
    return this.scootersService.checkAvailability(id, pickupDate, returnDate);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get scooter by ID' })
  findOne(@Param('id') id: string) {
    return this.scootersService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FilesInterceptor('images', 10, scooterImageStorage))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Update a scooter' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateScooterDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.scootersService.update(id, dto, files);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update scooter status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateScooterStatusDto) {
    return this.scootersService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Soft delete a scooter (Admin only)' })
  remove(@Param('id') id: string) {
    return this.scootersService.remove(id);
  }

  @Delete(':id/images')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Remove a specific image from a scooter' })
  removeImage(@Param('id') id: string, @Body('imageUrl') imageUrl: string) {
    return this.scootersService.removeImage(id, imageUrl);
  }
}
