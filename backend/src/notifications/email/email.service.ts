import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { BusinessConfig, baseEmailTemplate } from '../templates/base.template';
import { getTemplates, compileTemplate } from '../templates/template.renderer';
import * as path from 'path';
import { generateAgreementPdfBuffer } from '../../common/utils/pdf.util';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: any[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('gmail.user'),
        pass: this.configService.get<string>('gmail.password'),
      },
    });
  }

  /** Returns true when the email channel is enabled in config. */
  get isEnabled(): boolean {
    return this.configService.get<boolean>('notifications.emailEnabled') ?? false;
  }

  /** Shared business identity for templates. */
  private get biz(): BusinessConfig {
    return {
      name: this.configService.get<string>('business.name') ?? 'Migga Scooter Rentals',
      systemName: this.configService.get<string>('business.systemName') ?? 'Migga',
      supportEmail:
        this.configService.get<string>('business.supportEmail') ?? 'support@migga.lk',
      website: this.configService.get<string>('business.website') ?? 'https://migga.lk',
    };
  }

  getBizName(): string {
    return this.biz.name;
  }

  getBizSystemName(): string {
    return this.biz.systemName;
  }

  getBizSupportEmail(): string {
    return this.biz.supportEmail;
  }

  getBizWebsite(): string {
    return this.biz.website;
  }

  public buildContext(booking: any, extra?: any): Record<string, any> {
    return {
      bookingId: booking.bookingId ?? booking.id ?? '',
      customerName: booking.customerName ?? '',
      scooterTitle: booking.scooter?.title ?? 'Scooter',
      pickupDate: booking.pickupDate ? new Date(booking.pickupDate).toDateString() : '',
      returnDate: booking.returnDate ? new Date(booking.returnDate).toDateString() : '',
      totalAmount: booking.totalAmount ? Number(booking.totalAmount).toFixed(2) : '0.00',
      securityDeposit: booking.securityDeposit ? Number(booking.securityDeposit).toFixed(2) : '0.00',
      systemName: this.biz.systemName,
      paymentAmount: extra?.paymentAmount ? Number(extra.paymentAmount).toFixed(2) : '0.00',
      paymentLink: extra?.paymentLink ?? '',
    };
  }

  // ─── Core send ─────────────────────────────────────────────────────────────

  async send(options: EmailOptions): Promise<void> {
    if (!this.isEnabled) {
      this.logger.debug(`Email notifications are disabled — skipped: ${options.subject}`);
      return;
    }

    const fromName = this.configService.get<string>('gmail.fromName') ?? this.biz.name;
    const fromEmail = this.configService.get<string>('gmail.user');

    try {
      await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });
      this.logger.log(`✉️  Email sent → ${options.to} | ${options.subject}`);
    } catch (error) {
      this.logger.error(`Failed to send email → ${options.to} | ${options.subject}`, error);
    }
  }

  // ─── Booking Notifications ──────────────────────────────────────────────────

  /** Fired immediately when a new booking is created. */
  async sendBookingConfirmation(booking: any, paymentLink?: string): Promise<void> {
    const templates = getTemplates();
    const template = templates.new_booking_email;
    if (!template) {
      this.logger.warn('New booking email template not found');
      return;
    }

    const ctx = this.buildContext(booking, { paymentLink });
    const subject = compileTemplate(template.subject || '', ctx);
    let body = compileTemplate(template.body, ctx).replace(/\n/g, '<br/>');

    if (booking.qrCode) {
      body += this.getQrContent(booking);
    }

    const attachments = await this.getAttachments(booking);

    await this.send({
      to: booking.email,
      subject,
      html: baseEmailTemplate(body, this.biz),
      attachments,
    });
  }

  async sendBookingConfirmed(booking: any): Promise<void> {
    const templates = getTemplates();
    const template = templates.confirm_email;
    if (!template) {
      this.logger.warn('Confirm email template not found');
      return;
    }

    const ctx = this.buildContext(booking);
    const subject = compileTemplate(template.subject || '', ctx);
    let body = compileTemplate(template.body, ctx).replace(/\n/g, '<br/>');

    if (booking.qrCode) {
      body += this.getQrContent(booking);
    }

    const attachments = await this.getAttachments(booking);

    await this.send({
      to: booking.email,
      subject,
      html: baseEmailTemplate(body, this.biz),
      attachments,
    });
  }

  // ─── Payment Notifications ──────────────────────────────────────────────────

  async sendPaymentSuccess(booking: any, payment: any): Promise<void> {
    const templates = getTemplates();
    const template = templates.payment_success_email;
    if (!template) {
      this.logger.warn('Payment success email template not found');
      return;
    }

    const ctx = this.buildContext(booking, { paymentAmount: payment?.amount });
    const subject = compileTemplate(template.subject || '', ctx);
    let body = compileTemplate(template.body, ctx).replace(/\n/g, '<br/>');

    if (booking.qrCode) {
      body += this.getQrContent(booking);
    }

    const attachments = await this.getAttachments(booking);

    await this.send({
      to: booking.email,
      subject,
      html: baseEmailTemplate(body, this.biz),
      attachments,
    });
  }

  // ─── Rental Lifecycle Notifications ────────────────────────────────────────

  async sendReturnReminder(booking: any): Promise<void> {
    const templates = getTemplates();
    const template = templates.return_reminder_email;
    if (!template) {
      this.logger.warn('Return reminder email template not found');
      return;
    }

    const ctx = this.buildContext(booking);
    const subject = compileTemplate(template.subject || '', ctx);
    let body = compileTemplate(template.body, ctx).replace(/\n/g, '<br/>');

    if (booking.qrCode) {
      body += this.getQrContent(booking);
    }

    await this.send({
      to: booking.email,
      subject,
      html: baseEmailTemplate(body, this.biz),
      attachments: this.getQrAttachment(booking),
    });
  }

  async sendExtensionApproved(booking: any, extension: any): Promise<void> {
    await this.send({
      to: booking.email,
      subject: `Extension Approved — ${booking.bookingId} | ${this.biz.systemName}`,
      html: this.extensionApprovedTemplate(booking, extension),
      attachments: this.getQrAttachment(booking),
    });
  }

  async sendExtensionRejected(booking: any, extension: any): Promise<void> {
    await this.send({
      to: booking.email,
      subject: `Extension Rejected — ${booking.bookingId} | ${this.biz.systemName}`,
      html: this.extensionRejectedTemplate(booking, extension),
      attachments: this.getQrAttachment(booking),
    });
  }

  async sendExtensionRequested(booking: any, extension: any): Promise<void> {
    await this.send({
      to: booking.email,
      subject: `Extension Requested — ${booking.bookingId} | ${this.biz.systemName}`,
      html: this.extensionRequestedTemplate(booking, extension),
      attachments: this.getQrAttachment(booking),
    });
  }

  async sendWriteUsAReview(booking: any): Promise<void> {
    await this.send({
      to: booking.email,
      subject: `How was your rental? Leave us a review! ⭐ | ${this.biz.systemName}`,
      html: this.writeUsAReviewTemplate(booking),
      attachments: this.getQrAttachment(booking),
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private getQrContent(booking: any): string {
    if (booking.qrCode) {
      return `<br/><br/><div style="text-align: center; margin-top: 20px;"><img src="cid:qrcode" alt="Booking QR Code" style="width: 180px; height: 180px; border-radius: 12px; border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.15);" /><br/><strong style="color: #1a1a2e; font-size: 13px; font-family: Outfit, sans-serif;">Booking Reference QR Code</strong></div>`;
    }
    return '';
  }

  private async getAttachments(booking: any): Promise<any[] | undefined> {
    const attachments: any[] = [];
    if (booking.qrCode) {
      attachments.push({
        filename: `booking-${booking.bookingId}-qr.png`,
        path: booking.qrCode,
        cid: 'qrcode'
      });
    }
    
    try {
      const buffer = await generateAgreementPdfBuffer(booking);
      attachments.push({
        filename: `Rental-Agreement-${booking.bookingId}.pdf`,
        content: buffer,
      });
    } catch (err) {
      this.logger.error(`Failed to generate agreement PDF for email: ${err.message}`);
    }
    
    return attachments.length > 0 ? attachments : undefined;
  }

  private getQrAttachment(booking: any): any[] | undefined {
    if (booking.qrCode) {
      return [{
        filename: `booking-${booking.bookingId}-qr.png`,
        path: booking.qrCode,
        cid: 'qrcode'
      }];
    }
    return undefined;
  }

  // ─── Inline Templates (to be moved to /templates as needed) ────────────────

  private paymentSuccessTemplate(booking: any, payment: any): string {
    const content = `
      <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Payment Successful! ✅</h2>
      <p style="color:#555;margin-bottom:28px;font-size:15px;">
        Hi <strong>${booking.customerName}</strong>, we've received your payment.
      </p>
      <div class="info-card">
        <div class="info-row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
        <div class="info-row"><span class="label">Payment ID</span><span class="value">${payment.paymentId}</span></div>
        <div class="info-row"><span class="label">Amount Paid</span><span class="value">${payment.currency} ${Number(payment.amount).toFixed(2)}</span></div>
        <div class="info-row"><span class="label">Paid At</span><span class="value">${new Date(payment.paidAt).toLocaleString()}</span></div>
        <div class="info-row"><span class="label">Status</span><span class="badge badge-green">CONFIRMED</span></div>
      </div>
      <div class="divider"></div>
      <p style="color:#555;font-size:14px;line-height:1.7;">
        Your QR code has been generated. Please present it at pickup to collect your scooter.
        Questions? <a href="mailto:${this.biz.supportEmail}" style="color:#e94560;">${this.biz.supportEmail}</a>
      </p>
    `;
    return baseEmailTemplate(content, this.biz);
  }

  private returnReminderTemplate(booking: any): string {
    const content = `
      <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Return Reminder ⏰</h2>
      <p style="color:#555;margin-bottom:28px;font-size:15px;">
        Hi <strong>${booking.customerName}</strong>, your scooter is due for return soon.
      </p>
      <div class="info-card">
        <div class="info-row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
        <div class="info-row"><span class="label">Scooter</span><span class="value">${booking.scooter?.title ?? 'N/A'}</span></div>
        <div class="info-row"><span class="label">Return Date</span><span class="value">${new Date(booking.returnDate).toDateString()}</span></div>
      </div>
      <div class="note">Need more time? Contact us to request an extension before the return date.</div>
    `;
    return baseEmailTemplate(content, this.biz);
  }

  private extensionApprovedTemplate(booking: any, extension: any): string {
    const content = `
      <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Extension Approved! 🎉</h2>
      <p style="color:#555;margin-bottom:28px;font-size:15px;">
        Hi <strong>${booking.customerName}</strong>, your rental extension has been approved.
      </p>
      <div class="info-card">
        <div class="info-row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
        <div class="info-row"><span class="label">New Return Date</span><span class="value">${new Date(extension.requestedUntil).toDateString()}</span></div>
        <div class="info-row"><span class="label">Extra Amount Due</span><span class="value">Rs. ${Number(extension.extraAmount).toFixed(2)}</span></div>
        <div class="info-row"><span class="label">Payment Status</span><span class="badge badge-orange">PAY AT DROP-OFF</span></div>
      </div>
      <div class="note" style="margin-top:20px;padding:15px;background-color:#fff3cd;border-left:4px solid #ffc107;color:#856404;font-size:14px;border-radius:4px;">
        ⚠️ <strong>Payment Instructions:</strong> Please note that the extra amount of <strong>Rs. ${Number(extension.extraAmount).toFixed(2)}</strong> must be paid via <strong>Cash</strong> or <strong>Bank Transfer</strong> when you drop off the scooter at the end of your rental period.
      </div>
      ${this.getQrContent(booking)}
    `;
    return baseEmailTemplate(content, this.biz);
  }

  private extensionRejectedTemplate(booking: any, extension: any): string {
    const content = `
      <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Extension Request Rejected</h2>
      <p style="color:#555;margin-bottom:28px;font-size:15px;">
        Hi <strong>${booking.customerName}</strong>, unfortunately your extension request could not be approved.
      </p>
      <div class="info-card">
        <div class="info-row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
        <div class="info-row"><span class="label">Requested Until</span><span class="value">${new Date(extension.requestedUntil).toDateString()}</span></div>
        <div class="info-row"><span class="label">Original Return Date</span><span class="value">${new Date(booking.returnDate).toDateString()}</span></div>
      </div>
      <div class="note">Please ensure the scooter is returned by the original return date. Contact us if you have questions.</div>
      ${this.getQrContent(booking)}
    `;
    return baseEmailTemplate(content, this.biz);
  }

  private extensionRequestedTemplate(booking: any, extension: any): string {
    const content = `
      <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Extension Request Received ⏳</h2>
      <p style="color:#555;margin-bottom:28px;font-size:15px;">
        Hi <strong>${booking.customerName}</strong>, we have received your request to extend your rental.
      </p>
      <div class="info-card">
        <div class="info-row"><span class="label">Booking ID</span><span class="value">${booking.bookingId}</span></div>
        <div class="info-row"><span class="label">Requested Until</span><span class="value">${new Date(extension.requestedUntil).toDateString()}</span></div>
        <div class="info-row"><span class="label">Status</span><span class="badge badge-orange">PENDING APPROVAL</span></div>
      </div>
      <p style="color:#555;font-size:14px;line-height:1.7;margin-top:20px;">
        We will review your request shortly and notify you once it is approved or rejected.
      </p>
      ${this.getQrContent(booking)}
    `;
    return baseEmailTemplate(content, this.biz);
  }

  private writeUsAReviewTemplate(booking: any): string {
    const content = `
      <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Thank you for riding with us! 🛵</h2>
      <p style="color:#555;margin-bottom:28px;font-size:15px;">
        Hi <strong>${booking.customerName}</strong>, we hope you enjoyed your ride. Your booking <strong>${booking.bookingId}</strong> is now marked as returned.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <p style="color:#555;font-size:16px;margin-bottom:15px;">We would love to hear about your experience!</p>
        <a href="${this.biz.website}/reviews" style="background-color:#e94560;color:white;padding:12px 24px;text-decoration:none;font-weight:bold;border-radius:8px;display:inline-block;box-shadow: 0 4px 6px rgba(233,69,96,0.2);">Write a Review</a>
      </div>
      <p style="color:#555;font-size:14px;line-height:1.7;">
        If you have any feedback or suggestions, feel free to reply directly to this email. We hope to see you again soon!
      </p>
      ${this.getQrContent(booking)}
    `;
    return baseEmailTemplate(content, this.biz);
  }
}
