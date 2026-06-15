import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { BusinessConfig, baseEmailTemplate } from '../templates/base.template';
import { getTemplates, compileTemplate } from '../templates/template.renderer';

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
    const body = compileTemplate(template.body, ctx).replace(/\n/g, '<br/>');

    await this.send({
      to: booking.email,
      subject,
      html: baseEmailTemplate(body, this.biz),
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

    // Add inline QR image to body if qrCode exists
    if (booking.qrCode) {
      body += `<br/><br/><div style="text-align: center;"><img src="cid:qrcode" alt="Booking QR Code" style="width: 200px; height: 200px; border-radius: 12px; border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.15);" /><br/><strong style="color: #1a1a2e; font-size: 14px;">Present this QR code at pickup to collect your scooter</strong></div>`;
    }

    const attachments = booking.qrCode ? [
      {
        filename: `booking-${booking.bookingId}-qr.png`,
        path: booking.qrCode,
        cid: 'qrcode'
      }
    ] : undefined;

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

    // Add inline QR image to body if qrCode exists
    if (booking.qrCode) {
      body += `<br/><br/><div style="text-align: center;"><img src="cid:qrcode" alt="Booking QR Code" style="width: 200px; height: 200px; border-radius: 12px; border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.15);" /><br/><strong style="color: #1a1a2e; font-size: 14px;">Present this QR code at pickup to collect your scooter</strong></div>`;
    }

    const attachments = booking.qrCode ? [
      {
        filename: `booking-${booking.bookingId}-qr.png`,
        path: booking.qrCode,
        cid: 'qrcode'
      }
    ] : undefined;

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
    const body = compileTemplate(template.body, ctx).replace(/\n/g, '<br/>');

    await this.send({
      to: booking.email,
      subject,
      html: baseEmailTemplate(body, this.biz),
    });
  }

  async sendExtensionApproved(booking: any, extension: any): Promise<void> {
    await this.send({
      to: booking.email,
      subject: `Extension Approved — ${booking.bookingId} | ${this.biz.systemName}`,
      html: this.extensionApprovedTemplate(booking, extension),
    });
  }

  async sendExtensionRejected(booking: any, extension: any): Promise<void> {
    await this.send({
      to: booking.email,
      subject: `Extension Rejected — ${booking.bookingId} | ${this.biz.systemName}`,
      html: this.extensionRejectedTemplate(booking, extension),
    });
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
        <div class="info-row"><span class="label">Status</span><span class="badge badge-green">APPROVED</span></div>
      </div>
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
    `;
    return baseEmailTemplate(content, this.biz);
  }
}
