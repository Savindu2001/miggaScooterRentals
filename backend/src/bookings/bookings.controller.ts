import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { BookingStatus, Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { passportImageStorage, signatureImageStorage, agreementPdfStorage } from '../uploads/multer.config';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, UpdateBookingStatusDto, VerifyQrDto, SignAgreementDto } from './dto/update-booking.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'passportPhoto', maxCount: 1 },
        { name: 'idpPhoto', maxCount: 1 },
      ],
      passportImageStorage,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new booking with passport and IDP images' })
  create(
    @Body() dto: CreateBookingDto,
    @UploadedFiles()
    files: {
      passportPhoto?: Express.Multer.File[];
      idpPhoto?: Express.Multer.File[];
    },
  ) {
    return this.bookingsService.create(dto, files);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List all bookings with pagination and filters' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  findAll(
    @Query('status') status?: BookingStatus,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.bookingsService.findAll({ status, search, page, limit, startDate, endDate });
  }

  @Post('verify-qr')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Verify QR code for scooter pickup (one-time use)' })
  @ApiResponse({ status: 200, description: 'QR verified, booking marked as Picked Up' })
  @ApiResponse({ status: 409, description: 'QR already used' })
  verifyQr(@Body() dto: VerifyQrDto) {
    return this.bookingsService.verifyQr(dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get booking by internal ID' })
  findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  @Public()
  @Get('ref/:bookingId')
  @ApiOperation({ summary: 'Get booking by booking reference (MS-XXX-YYYYMMDD) — for customer use' })
  findByBookingId(@Param('bookingId') bookingId: string) {
    return this.bookingsService.findByBookingId(bookingId);
  }

  @Public()
  @Post('customer')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'passportPhoto', maxCount: 1 },
        { name: 'idpPhoto', maxCount: 1 },
      ],
      passportImageStorage,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a new booking (public — customer-facing web form)' })
  createPublic(
    @Body() dto: CreateBookingDto,
    @UploadedFiles()
    files: {
      passportPhoto?: Express.Multer.File[];
      idpPhoto?: Express.Multer.File[];
    },
  ) {
    return this.bookingsService.create(dto, files);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update booking details' })
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookingsService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update booking status' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(id, dto);
  }

  @Post(':id/resend-payment-link')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Resend payment link email & WhatsApp to customer' })
  resendPaymentLink(@Param('id') id: string) {
    return this.bookingsService.resendPaymentLink(id);
  }

  @Post(':id/resend-qr')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Resend QR code email & WhatsApp to customer' })
  resendQrCode(@Param('id') id: string) {
    return this.bookingsService.resendQrCode(id);
  }

  @Post(':id/passport-images')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'passportPhoto', maxCount: 1 },
        { name: 'idpPhoto', maxCount: 1 },
      ],
      passportImageStorage,
    ),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload passport & IDP images for a booking' })
  uploadPassportImages(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      passportPhoto?: Express.Multer.File[];
      idpPhoto?: Express.Multer.File[];
    },
  ) {
    return this.bookingsService.uploadPassportImages(id, files);
  }

  @Public()
  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign agreement — upload signature image or provide base64' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('signatureFile', signatureImageStorage))
  signAgreement(
    @Param('id') id: string,
    @UploadedFile() signatureFile: Express.Multer.File,
    @Body() dto: SignAgreementDto,
  ) {
    return this.bookingsService.signAgreement(id, signatureFile, dto.signatureBase64);
  }

  @Post(':id/agreement-pdf')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseInterceptors(FileInterceptor('agreementPdf', agreementPdfStorage))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload agreement PDF for a booking' })
  uploadAgreementPdf(
    @Param('id') id: string,
    @UploadedFile() pdfFile: Express.Multer.File,
  ) {
    return this.bookingsService.uploadAgreementPdf(id, pdfFile);
  }
}
