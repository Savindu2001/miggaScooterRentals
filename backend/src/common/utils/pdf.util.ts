import { PDFDocument } from 'pdf-lib';
import { renderAgreementPdf } from '../../notifications/templates/agreement-pdf.template';

export async function generateAgreementPdfBuffer(booking: any): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  await renderAgreementPdf(pdfDoc, booking);
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
