import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { BookingStatus, ScooterStatus, PaymentStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { generateBookingId } from '../common/utils/booking-id.util';
import { generateQrCode } from '../common/utils/qr.util';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, UpdateBookingStatusDto, VerifyQrDto, ConfirmPickupDto, ConfirmReturnDto } from './dto/update-booking.dto';
import { EmailService } from '../notifications/email/email.service';
import { WhatsAppService } from '../notifications/whatsapp/whatsapp.service';
import { PaymentsService } from '../payments/payments.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { generateAgreementPdfBuffer } from '../common/utils/pdf.util';

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
      bankSlip?: Express.Multer.File[];
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

    // Handle passport & IDP images & bank slip
    const passportPhoto = files?.passportPhoto?.[0]
      ? `/uploads/passports/${files.passportPhoto[0].filename}`
      : undefined;
    const idpPhoto = files?.idpPhoto?.[0]
      ? `/uploads/passports/${files.idpPhoto[0].filename}`
      : undefined;
    const bankSlipImage = files?.bankSlip?.[0]
      ? `/uploads/passports/${files.bankSlip[0].filename}`
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
          paymentMethod: (dto as any).paymentMethod,
          bankSlipImage,
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

    if (dto.bookingStatus === BookingStatus.RETURNED) {
      const pendingExtension = booking.extensions?.find(
        (ext) => ext.status === 'APPROVED' && ext.paymentStatus === PaymentStatus.PENDING
      );
      if (pendingExtension) {
        throw new BadRequestException('Cannot mark scooter as returned. There is an unpaid extension due amount of Rs. ' + Number(pendingExtension.extraAmount).toFixed(2));
      }
    }

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
    } else if (dto.bookingStatus === BookingStatus.RETURNED) {
      void this.emailService.sendWriteUsAReview(updatedBooking);
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

    const updated = await this.prisma.booking.update({
      where: { id },
      data: {
        agreementSigned: true,
        signedAt: new Date(),
        signatureImage,
      },
    });

    return updated;
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

    const frontendUrl = this.configService.get<string>('frontendUrl') || 'http://localhost:3001';
    const paymentLink = `${frontendUrl}/booking/${booking.id}`;

    // Fire-and-forget: send booking confirmation email & WhatsApp to customer with the payment link
    void this.emailService.sendBookingConfirmation(booking, paymentLink);
    void this.whatsAppService.sendBookingConfirmation(booking, paymentLink);

    return { success: true, message: 'Payment instructions resent successfully', paymentLink };
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

  async confirmBooking(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { scooter: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    let targetStatus: BookingStatus;
    if (booking.paymentMethod === 'BANK_TRANSFER') {
      targetStatus = BookingStatus.PENDING;
    } else {
      targetStatus = BookingStatus.AWAITING_PAYMENT;
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        bookingStatus: targetStatus,
      },
      include: { scooter: true },
    });

    // Create a pending payment record if it doesn't already exist for this booking
    const existingPayment = await this.prisma.payment.findFirst({
      where: { bookingId: id },
    });
    if (!existingPayment) {
      const paymentId = `PAY-${uuidv4().split('-')[0].toUpperCase()}`;
      await this.prisma.payment.create({
        data: {
          paymentId,
          bookingId: id,
          amount: booking.totalAmount,
          currency: 'LKR',
          paymentStatus: PaymentStatus.PENDING,
          paymentMethod: booking.paymentMethod || 'CASH',
        },
      });
    }

    // Trigger confirmation notification (sends QR code)
    void this.emailService.sendBookingConfirmed(updatedBooking);
    void this.whatsAppService.sendBookingConfirmed(updatedBooking);

    return updatedBooking;
  }

  async scanQr(dto: VerifyQrDto) {
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
      include: {
        scooter: true,
        payments: true,
        extensions: true,
        deliveryZone: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found or QR code is invalid');

    return booking;
  }

  async confirmPickup(id: string, dto: ConfirmPickupDto) {
    const booking = await this.findOne(id);
    if (!booking) throw new NotFoundException('Booking not found');

    let finalTotalAmount = Number(booking.totalAmount);
    if (dto.paymentMethod === 'CARD') {
      // Add 3.5% processing fee to the total amount
      const cardFee = finalTotalAmount * 0.035;
      finalTotalAmount += cardFee;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Update Booking
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          bookingStatus: BookingStatus.PICKED_UP,
          qrUsed: true,
          paymentMethod: dto.paymentMethod,
          totalAmount: finalTotalAmount,
        },
        include: { scooter: true },
      });

      // 2. Update Scooter to RENTED
      await tx.scooter.update({
        where: { id: booking.scooterId },
        data: { status: ScooterStatus.RENTED },
      });

      // 3. Register manual payment or update existing
      const existingPayment = await tx.payment.findFirst({
        where: { bookingId: id },
      });

      if (existingPayment) {
        await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            paymentMethod: dto.paymentMethod,
            amount: finalTotalAmount,
            paymentStatus: PaymentStatus.COMPLETED,
            paidAt: new Date(),
            referenceNote: dto.referenceNote || 'Payment confirmed at pickup',
          },
        });
      } else {
        const paymentId = `PAY-${uuidv4().split('-')[0].toUpperCase()}`;
        await tx.payment.create({
          data: {
            paymentId,
            bookingId: id,
            amount: finalTotalAmount,
            currency: 'LKR',
            paymentStatus: PaymentStatus.COMPLETED,
            paymentMethod: dto.paymentMethod,
            paidAt: new Date(),
            referenceNote: dto.referenceNote || 'Payment confirmed at pickup',
          },
        });
      }

      return updatedBooking;
    });

    return updated;
  }

  async confirmReturn(id: string, dto: ConfirmReturnDto) {
    const booking = await this.findOne(id);
    if (!booking) throw new NotFoundException('Booking not found');

    const pendingExtension = booking.extensions?.find(
      (ext) => ext.status === 'APPROVED' && ext.paymentStatus === PaymentStatus.PENDING
    );
    if (pendingExtension && (!dto.extensionId || dto.extensionId !== pendingExtension.id)) {
      throw new BadRequestException('Cannot mark scooter as returned. There is an unpaid extension due amount of Rs. ' + Number(pendingExtension.extraAmount).toFixed(2));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Process extension payment if extensionId is provided
      if (dto.extensionId) {
        await tx.bookingExtension.update({
          where: { id: dto.extensionId },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            paymentMethod: dto.paymentMethod || 'CASH',
          },
        });

        // Register payment record
        const paymentId = `PAY-${uuidv4().split('-')[0].toUpperCase()}`;
        await tx.payment.create({
          data: {
            paymentId,
            bookingId: id,
            amount: dto.amountPaid || 0,
            currency: 'LKR',
            paymentStatus: PaymentStatus.COMPLETED,
            paymentMethod: dto.paymentMethod || 'CASH',
            paidAt: new Date(),
            referenceNote: dto.referenceNote || `Extension payment confirmed at return`,
          },
        });
      }

      // 2. Update Booking Status
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          bookingStatus: BookingStatus.RETURNED,
        },
        include: { scooter: true },
      });

      // 3. Update Scooter Status to AVAILABLE
      await tx.scooter.update({
        where: { id: booking.scooterId },
        data: { status: ScooterStatus.AVAILABLE },
      });

      return updatedBooking;
    });

    if (updated) {
      void this.emailService.sendWriteUsAReview(updated);
    }

    return updated;
  }

  async getAgreementPdf(id: string): Promise<Buffer> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { scooter: true },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.agreementSigned) {
      throw new BadRequestException('Agreement has not been signed yet');
    }
    return generateAgreementPdfBuffer(booking);
  }

  getAgreementRules() {
    const rulesPath = path.join(process.cwd(), 'src', 'notifications', 'templates', 'rules.json');
    if (fs.existsSync(rulesPath)) {
      const data = fs.readFileSync(rulesPath, 'utf8');
      return JSON.parse(data);
    }
    return [];
  }
}
