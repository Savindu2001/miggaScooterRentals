import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { getTemplates, compileTemplate } from '../templates/template.renderer';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    const version = this.configService.get<string>('whatsapp.apiVersion') ?? 'v19.0';
    const phoneNumberId = this.configService.get<string>('whatsapp.phoneNumberId');
    return `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
  }

  private get accessToken(): string {
    return this.configService.get<string>('whatsapp.accessToken') ?? '';
  }

  private get systemName(): string {
    return this.configService.get<string>('business.systemName') ?? 'Migga';
  }

  private buildContext(booking: any, extra?: any): Record<string, any> {
    return {
      bookingId: booking.bookingId ?? booking.id ?? '',
      customerName: booking.customerName ?? '',
      scooterTitle: booking.scooter?.title ?? 'Scooter',
      pickupDate: booking.pickupDate ? new Date(booking.pickupDate).toDateString() : '',
      returnDate: booking.returnDate ? new Date(booking.returnDate).toDateString() : '',
      totalAmount: booking.totalAmount ? Number(booking.totalAmount).toFixed(2) : '0.00',
      securityDeposit: booking.securityDeposit ? Number(booking.securityDeposit).toFixed(2) : '0.00',
      systemName: this.systemName,
      paymentAmount: extra?.paymentAmount ? Number(extra.paymentAmount).toFixed(2) : '0.00',
      paymentLink: extra?.paymentLink ?? '',
    };
  }

  async sendText(to: string, message: string): Promise<void> {
    if (!this.accessToken || !this.configService.get<string>('whatsapp.phoneNumberId')) {
      this.logger.warn('WhatsApp not configured — skipping message');
      return;
    }

    // Normalize phone number: remove spaces, ensure + prefix
    const phone = to.replace(/\s+/g, '').replace(/^00/, '+');

    try {
      await axios.post(
        this.baseUrl,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
      this.logger.log(`WhatsApp message sent to ${phone}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send WhatsApp to ${phone}`,
        error?.response?.data ?? error.message,
      );
    }
  }

  async sendBookingConfirmation(booking: any, paymentLink?: string): Promise<void> {
    const templates = getTemplates();
    const template = templates.new_booking_whatsapp;
    if (!template) {
      this.logger.warn('New booking WhatsApp template not found');
      return;
    }

    const ctx = this.buildContext(booking, { paymentLink });
    const body = compileTemplate(template.body, ctx);
    await this.sendText(booking.phone, body);
  }

  async sendBookingConfirmed(booking: any): Promise<void> {
    const templates = getTemplates();
    const template = templates.confirm_whatsapp;
    if (!template) {
      this.logger.warn('Confirm WhatsApp template not found');
      return;
    }

    const ctx = this.buildContext(booking);
    const body = compileTemplate(template.body, ctx);
    await this.sendText(booking.phone, body);
  }

  async sendPaymentSuccess(booking: any, payment: any): Promise<void> {
    const templates = getTemplates();
    const template = templates.payment_success_whatsapp;
    if (!template) {
      this.logger.warn('Payment success WhatsApp template not found');
      return;
    }

    const ctx = this.buildContext(booking, { paymentAmount: payment?.amount });
    const body = compileTemplate(template.body, ctx);
    await this.sendText(booking.phone, body);
  }

  async sendReturnReminder(booking: any): Promise<void> {
    const templates = getTemplates();
    const template = templates.return_reminder_whatsapp;
    if (!template) {
      this.logger.warn('Return reminder WhatsApp template not found');
      return;
    }

    const ctx = this.buildContext(booking);
    const body = compileTemplate(template.body, ctx);
    await this.sendText(booking.phone, body);
  }

  async sendExtensionApproved(booking: any, extension: any): Promise<void> {
    const msg = `🛵 *MIGGA RENTALS*\n\nHello ${booking.customerName}!\n\n🎉 *Extension Approved!*\n\n📋 *Booking:* ${booking.bookingId}\n📅 *New Return Date:* ${new Date(extension.requestedUntil).toDateString()}\n\nEnjoy your extended rental!`;
    await this.sendText(booking.phone, msg);
  }

  async sendExtensionRejected(booking: any, extension: any): Promise<void> {
    const msg = `🛵 *MIGGA RENTALS*\n\nHello ${booking.customerName}!\n\nWe're sorry, your extension request for booking *${booking.bookingId}* has been rejected.\n\n📅 Please return the scooter by: *${new Date(booking.returnDate).toDateString()}*\n\nContact us if you have questions.`;
    await this.sendText(booking.phone, msg);
  }
}
