import * as QRCode from 'qrcode';

export interface QrPayload {
  bookingId: string;
  verificationToken: string;
}

/**
 * Generates a base64-encoded PNG QR code from a payload object.
 */
export async function generateQrCode(payload: QrPayload): Promise<string> {
  const data = JSON.stringify(payload);
  const base64 = await QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 300,
    margin: 2,
  });
  return base64;
}
