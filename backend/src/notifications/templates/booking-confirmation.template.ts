import { baseEmailTemplate, BusinessConfig } from './base.template';

/**
 * Sent to the customer immediately after a new booking is created.
 * Includes all key booking details and a prompt to complete payment.
 */
export function bookingConfirmationTemplate(
  booking: {
    bookingId: string;
    customerName: string;
    email: string;
    scooter?: { title?: string } | null;
    pickupDate: Date | string;
    returnDate: Date | string;
    rentalDays: number;
    totalAmount: number | string;
    securityDeposit?: number | string;
    bookingStatus: string;
    pickupType?: string;
    deliveryZone?: { zoneName?: string } | null;
    notes?: string | null;
  },
  biz: BusinessConfig,
): string {
  const pickupLabel =
    booking.pickupType === 'DELIVERY' && booking.deliveryZone?.zoneName
      ? `Delivery — ${booking.deliveryZone.zoneName}`
      : 'Self Pickup';

  const content = `
    <h2 style="color:#1a1a2e;margin-bottom:8px;font-size:22px;">Booking Confirmed! 🛵</h2>
    <p style="color:#555;margin-bottom:28px;font-size:15px;">
      Hi <strong>${booking.customerName}</strong>, your booking has been received successfully.
      Please complete payment to secure your reservation.
    </p>

    <div class="info-card">
      <div class="info-row">
        <span class="label">Booking ID</span>
        <span class="value">${booking.bookingId}</span>
      </div>
      <div class="info-row">
        <span class="label">Scooter</span>
        <span class="value">${booking.scooter?.title ?? 'N/A'}</span>
      </div>
      <div class="info-row">
        <span class="label">Pickup Type</span>
        <span class="value">${pickupLabel}</span>
      </div>
      <div class="info-row">
        <span class="label">Pickup Date</span>
        <span class="value">${new Date(booking.pickupDate).toDateString()}</span>
      </div>
      <div class="info-row">
        <span class="label">Return Date</span>
        <span class="value">${new Date(booking.returnDate).toDateString()}</span>
      </div>
      <div class="info-row">
        <span class="label">Rental Days</span>
        <span class="value">${booking.rentalDays} day${booking.rentalDays === 1 ? '' : 's'}</span>
      </div>
      <div class="info-row">
        <span class="label">Total Amount</span>
        <span class="value">$${Number(booking.totalAmount).toFixed(2)}</span>
      </div>
      ${
        booking.securityDeposit
          ? `<div class="info-row">
               <span class="label">Security Deposit</span>
               <span class="value">$${Number(booking.securityDeposit).toFixed(2)}</span>
             </div>`
          : ''
      }
      <div class="info-row">
        <span class="label">Status</span>
        <span class="badge badge-orange">${booking.bookingStatus}</span>
      </div>
    </div>

    ${
      booking.notes
        ? `<div class="note">📝 <strong>Notes:</strong> ${booking.notes}</div>`
        : ''
    }

    <div class="divider"></div>
    <p style="color:#555;font-size:14px;line-height:1.7;">
      Your QR code for scooter pickup will be sent after payment is confirmed.
      If you have any questions, reply to this email or contact us at
      <a href="mailto:${biz.supportEmail}" style="color:#e94560;">${biz.supportEmail}</a>.
    </p>
  `;

  return baseEmailTemplate(content, biz);
}
