import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, ScooterStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { generateBookingId } from '../common/utils/booking-id.util';
import { generateQrCode } from '../common/utils/qr.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, UpdateBookingStatusDto, VerifyQrDto } from './dto/update-booking.dto';
import { EmailService } from '../notifications/email/email.service';
import { WhatsAppService } from '../notifications/whatsapp/whatsapp.service';
import { PaymentsService } from '../payments/payments.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    dto: CreateBookingDto,
    files?: {
      passportPhoto?: Express.Multer.File[];
      idpPhoto?: Express.Multer.File[];
    },
  ) {
    // Check scooter exists
    const scooter = await this.prisma.scooter.findFirst({
      where: { id: dto.scooterId, isDeleted: false },
    });
    if (!scooter) throw new NotFoundException('Scooter not found');
    if (scooter.status === ScooterStatus.MAINTENANCE) {
      throw new ConflictException('Scooter is currently in maintenance and cannot be booked');
    }

    // Check date overlap
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        scooterId: dto.scooterId,
        bookingStatus: { notIn: [BookingStatus.CANCELLED, BookingStatus.RETURNED] },
        pickupDate: { lte: new Date(dto.returnDate) },
        returnDate: { gte: new Date(dto.pickupDate) },
      },
    });
    if (overlapping) {
      throw new ConflictException('Scooter is already booked for the selected dates');
    }

    // Generate booking ID and verification token
    const bookingId = await generateBookingId(this.prisma as any);
    const verificationToken = uuidv4();

    // Generate QR code
    const qrCode = await generateQrCode({ bookingId, verificationToken });

    // Handle passport & IDP images
    const passportPhoto = files?.passportPhoto?.[0]
      ? `/uploads/passports/${files.passportPhoto[0].filename}`
      : undefined;
    const idpPhoto = files?.idpPhoto?.[0]
      ? `/uploads/passports/${files.idpPhoto[0].filename}`
      : undefined;

    const booking = await this.prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          bookingId,
          scooterId: dto.scooterId,
          customerName: dto.customerName,
          nationality: dto.nationality,
          passportNumber: dto.passportNumber,
          passportPhoto,
          idpPhoto,
          email: dto.email,
          phone: dto.phone,
          pickupDate: new Date(dto.pickupDate),
          returnDate: new Date(dto.returnDate),
          rentalDays: dto.rentalDays,
          totalAmount: dto.totalAmount,
          securityDeposit: dto.securityDeposit,
          bookingStatus: BookingStatus.PENDING,
          qrCode,
          verificationToken,
          pickupType: dto.pickupType,
          deliveryFee: dto.deliveryFee ?? 0,
          deliveryZoneId: dto.deliveryZoneId,
          notes: dto.notes,
        },
        include: { scooter: true, deliveryZone: true },
      });

      // Mark scooter as reserved
      await tx.scooter.update({
        where: { id: dto.scooterId },
        data: { status: ScooterStatus.RESERVED },
      });

      return newBooking;
    });

    // Auto-create PayPal order to get payment link
    let paymentLink = '';
    try {
      const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3001';
      const order = await this.paymentsService.createOrder({
        bookingId: booking.id,
        returnUrl: `${frontendUrl}/payments/success`,
        cancelUrl: `${frontendUrl}/payments/cancel`,
      });
      paymentLink = order.approvalUrl || '';
    } catch (error) {
      this.logger.error(`Failed to auto-create PayPal order for booking ${booking.id}`, error);
    }

    // Fire-and-forget: send booking confirmation email & WhatsApp to customer with the payment link
    void this.emailService.sendBookingConfirmation(booking, paymentLink);
    void this.whatsAppService.sendBookingConfirmation(booking, paymentLink);

    return booking;
  }

  async findAll(params: {
    status?: BookingStatus;
    search?: string;
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) {
    const { status, search, page = 1, limit = 20, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.bookingStatus = status;
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }
    if (search) {
      where.OR = [
        { bookingId: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { passportNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { scooter: true, payments: true },
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        scooter: true,
        payments: true,
        extensions: true,
        deliveryZone: true,
      },
    });
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async findByBookingId(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingId },
      include: { scooter: true, payments: true, extensions: true, deliveryZone: true },
    });
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);
    return booking;
  }

  async update(id: string, dto: UpdateBookingDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.pickupDate) data.pickupDate = new Date(dto.pickupDate);
    if (dto.returnDate) data.returnDate = new Date(dto.returnDate);
    return this.prisma.booking.update({
      where: { id },
      data,
      include: { scooter: true, payments: true },
    });
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto) {
    const booking = await this.findOne(id);

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: { bookingStatus: dto.bookingStatus },
      include: { scooter: true },
    });

    // Sync scooter status
    if (dto.bookingStatus === BookingStatus.PICKED_UP) {
      await this.prisma.scooter.update({
        where: { id: booking.scooterId },
        data: { status: ScooterStatus.RENTED },
      });
    } else if (
      dto.bookingStatus === BookingStatus.RETURNED ||
      dto.bookingStatus === BookingStatus.CANCELLED
    ) {
      await this.prisma.scooter.update({
        where: { id: booking.scooterId },
        data: { status: ScooterStatus.AVAILABLE },
      });
    }

    if (dto.bookingStatus === BookingStatus.CONFIRMED) {
      void this.emailService.sendBookingConfirmed(updatedBooking);
      void this.whatsAppService.sendBookingConfirmed(updatedBooking);
    }

    return updatedBooking;
  }

  async verifyQr(dto: VerifyQrDto) {
    let payload: { bookingId: string; verificationToken: string };
    try {
      payload = JSON.parse(dto.qrData);
    } catch {
      throw new BadRequestException('Invalid QR data format');
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        bookingId: payload.bookingId,
        verificationToken: payload.verificationToken,
      },
    });

    if (!booking) throw new NotFoundException('QR code is invalid');
    if (booking.qrUsed) {
      throw new ConflictException('This QR code has already been used');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          qrUsed: true,
          bookingStatus: BookingStatus.PICKED_UP,
        },
      });
      await tx.scooter.update({
        where: { id: booking.scooterId },
        data: { status: ScooterStatus.RENTED },
      });
      return b;
    });

    return {
      message: 'QR verified successfully. Scooter picked up.',
      booking: updated,
    };
  }

  async uploadPassportImages(
    id: string,
    files: {
      passportPhoto?: Express.Multer.File[];
      idpPhoto?: Express.Multer.File[];
    },
  ) {
    await this.findOne(id);
    const data: any = {};
    if (files.passportPhoto?.[0]) {
      data.passportPhoto = `/uploads/passports/${files.passportPhoto[0].filename}`;
    }
    if (files.idpPhoto?.[0]) {
      data.idpPhoto = `/uploads/passports/${files.idpPhoto[0].filename}`;
    }
    return this.prisma.booking.update({ where: { id }, data });
  }

  async signAgreement(
    id: string,
    signatureFile?: Express.Multer.File,
    signatureBase64?: string,
  ) {
    const booking = await this.findOne(id);

    if (booking.agreementSigned) {
      throw new ConflictException('Agreement has already been signed');
    }

    let signatureImage: string | undefined;

    if (signatureFile) {
      signatureImage = `/uploads/signatures/${signatureFile.filename}`;
    } else if (signatureBase64) {
      // Save base64 as file
      const filename = `${uuidv4()}.png`;
      const filePath = path.join(process.cwd(), 'uploads', 'signatures', filename);
      const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      signatureImage = `/uploads/signatures/${filename}`;
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        agreementSigned: true,
        signedAt: new Date(),
        signatureImage,
      },
    });
  }

  async uploadAgreementPdf(id: string, pdfFile: Express.Multer.File) {
    await this.findOne(id);
    return this.prisma.booking.update({
      where: { id },
      data: { agreementPdf: `/uploads/agreements/${pdfFile.filename}` },
    });
  }

  async resendPaymentLink(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { scooter: true, deliveryZone: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Auto-create PayPal order to get payment link
    let paymentLink = '';
    try {
      const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3001';
      const order = await this.paymentsService.createOrder({
        bookingId: booking.id,
        returnUrl: `${frontendUrl}/payments/success`,
        cancelUrl: `${frontendUrl}/payments/cancel`,
      });
      paymentLink = order.approvalUrl || '';
    } catch (error) {
      this.logger.error(`Failed to auto-create PayPal order for resend on booking ${booking.id}`, error);
    }

    // Fire-and-forget: send booking confirmation email & WhatsApp to customer with the payment link
    void this.emailService.sendBookingConfirmation(booking, paymentLink);
    void this.whatsAppService.sendBookingConfirmation(booking, paymentLink);

    return { success: true, message: 'Payment link resent successfully', paymentLink };
  }

  async resendQrCode(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { scooter: true, deliveryZone: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.bookingStatus === BookingStatus.CANCELLED) {
      throw new BadRequestException('Cannot resend QR code for a cancelled booking');
    }

    // Fire-and-forget: send booking confirmed email & WhatsApp containing QR code
    void this.emailService.sendBookingConfirmed(booking);
    void this.whatsAppService.sendBookingConfirmed(booking);

    return { success: true, message: 'QR Code resent successfully' };
  }
}
