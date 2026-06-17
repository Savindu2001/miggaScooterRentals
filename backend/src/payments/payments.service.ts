import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingStatus, PaymentStatus } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { v4 as uuidv4 } from 'uuid';
import { EmailService } from '../notifications/email/email.service';
import { WhatsAppService } from '../notifications/whatsapp/whatsapp.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly whatsAppService: WhatsAppService,
  ) {
    const mode = this.configService.get<string>('paypal.mode');
    this.baseUrl =
      mode === 'live'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  private get paypalClientId(): string {
    const mode = this.configService.get<string>('paypal.mode');
    return mode === 'live'
      ? (this.configService.get<string>('paypal.clientIdLive') ?? '')
      : (this.configService.get<string>('paypal.clientIdSandbox') ?? '');
  }

  private get paypalSecret(): string {
    const mode = this.configService.get<string>('paypal.mode');
    return mode === 'live'
      ? (this.configService.get<string>('paypal.secretLive') ?? '')
      : (this.configService.get<string>('paypal.secretSandbox') ?? '');
  }

  private async getAccessToken(): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: { username: this.paypalClientId, password: this.paypalSecret },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      return response.data.access_token;
    } catch (err: any) {
      const errData = err?.response?.data;
      this.logger.error(
        `Failed to get PayPal access token. Base URL: ${this.baseUrl}. Error: ${
          errData ? JSON.stringify(errData) : err.message
        }`,
      );
      throw new BadRequestException(
        errData?.error_description ?? 'PayPal authentication failed',
      );
    }
  }

  async createOrder(dto: CreatePaymentDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const currency = dto.currency ?? 'USD';
    const amount = Number(booking.totalAmount).toFixed(2);

    let accessToken: string;
    try {
      accessToken = await this.getAccessToken();
    } catch (err) {
      throw err;
    }

    let orderData: any;
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: booking.bookingId,
              description: `Migga Scooter Rental - ${booking.bookingId}`,
              amount: {
                currency_code: currency,
                value: amount,
              },
            },
          ],
          application_context: {
            return_url: dto.returnUrl,
            cancel_url: dto.cancelUrl,
            brand_name: 'Migga Rentals',
            user_action: 'PAY_NOW',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      orderData = response.data;
    } catch (err: any) {
      const errData = err?.response?.data;
      this.logger.error(
        `PayPal create order error: ${
          errData ? JSON.stringify(errData) : err.message
        }`,
      );
      throw new BadRequestException(
        errData?.message ?? 'PayPal order creation failed',
      );
    }

    const approvalUrl = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

    // Create payment record
    const paymentId = `PAY-${uuidv4().split('-')[0].toUpperCase()}`;
    const payment = await this.prisma.payment.create({
      data: {
        paymentId,
        bookingId: dto.bookingId,
        paypalOrderId: orderData.id,
        amount: booking.totalAmount,
        currency,
        paymentStatus: PaymentStatus.PENDING,
      },
    });

    // Update booking status to Awaiting Payment
    await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: { bookingStatus: BookingStatus.AWAITING_PAYMENT },
    });

    return {
      payment,
      paypalOrderId: orderData.id,
      approvalUrl,
      status: orderData.status,
    };
  }

  async captureOrder(paypalOrderId: string) {
    const accessToken = await this.getAccessToken();

    let captureResponse: any;
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      captureResponse = response.data;
    } catch (err: any) {
      this.logger.error('PayPal capture error', err?.response?.data);
      throw new BadRequestException(
        err?.response?.data?.message ?? 'PayPal capture failed',
      );
    }

    const captureStatus = captureResponse.status;
    const payment = await this.prisma.payment.findFirst({
      where: { paypalOrderId },
    });

    if (!payment) throw new NotFoundException('Payment record not found');

    if (captureStatus === 'COMPLETED') {
      const [updatedPayment] = await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymentStatus: PaymentStatus.COMPLETED,
            paidAt: new Date(),
          },
        }),
        this.prisma.booking.update({
          where: { id: payment.bookingId },
          data: { bookingStatus: BookingStatus.CONFIRMED },
        }),
      ]);

      const fullBooking = await this.prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: { scooter: true },
      });
      if (fullBooking) {
        void this.emailService.sendPaymentSuccess(fullBooking, updatedPayment);
        void this.whatsAppService.sendPaymentSuccess(fullBooking, updatedPayment);
        void this.emailService.sendBookingConfirmed(fullBooking);
        void this.whatsAppService.sendBookingConfirmed(fullBooking);
      }

      return {
        message: 'Payment captured successfully',
        payment: updatedPayment,
        paypalStatus: captureStatus,
      };
    }

    return {
      message: 'Payment not completed',
      paypalStatus: captureStatus,
      details: captureResponse,
    };
  }

  async handleWebhook(payload: any) {
    const eventType = payload.event_type as string;
    this.logger.log(`PayPal webhook received: ${eventType}`);

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = payload.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        const payment = await this.prisma.payment.findFirst({
          where: { paypalOrderId: orderId },
        });
        if (payment && payment.paymentStatus !== PaymentStatus.COMPLETED) {
          const [updatedPayment] = await this.prisma.$transaction([
            this.prisma.payment.update({
              where: { id: payment.id },
              data: { paymentStatus: PaymentStatus.COMPLETED, paidAt: new Date() },
            }),
            this.prisma.booking.update({
              where: { id: payment.bookingId },
              data: { bookingStatus: BookingStatus.CONFIRMED },
            }),
          ]);

          const fullBooking = await this.prisma.booking.findUnique({
            where: { id: payment.bookingId },
            include: { scooter: true },
          });
          if (fullBooking) {
            void this.emailService.sendPaymentSuccess(fullBooking, updatedPayment);
            void this.whatsAppService.sendPaymentSuccess(fullBooking, updatedPayment);
            void this.emailService.sendBookingConfirmed(fullBooking);
            void this.whatsAppService.sendBookingConfirmed(fullBooking);
          }
        }
      }
    }

    if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const orderId = payload.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        await this.prisma.payment.updateMany({
          where: { paypalOrderId: orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED },
        });
      }
    }

    return { received: true };
  }

  async getBookingPayments(bookingId: string) {
    return this.prisma.payment.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, search, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { paymentId: { contains: search, mode: 'insensitive' } },
        { paypalOrderId: { contains: search, mode: 'insensitive' } },
        {
          booking: {
            OR: [
              { bookingId: { contains: search, mode: 'insensitive' } },
              { customerName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        if (endDate.length <= 10) {
          end.setHours(23, 59, 59, 999);
        }
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { booking: true },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async confirmPayment(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      },
    });

    const updatedBooking = await this.prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        bookingStatus: BookingStatus.CONFIRMED,
      },
      include: { scooter: true },
    });

    // Send notifications
    void this.emailService.sendPaymentSuccess(updatedBooking, updatedPayment);
    void this.whatsAppService.sendPaymentSuccess(updatedBooking, updatedPayment);
    void this.emailService.sendBookingConfirmed(updatedBooking);
    void this.whatsAppService.sendBookingConfirmed(updatedBooking);

    return {
      message: 'Payment confirmed successfully',
      payment: updatedPayment,
      booking: updatedBooking,
    };
  }
}

