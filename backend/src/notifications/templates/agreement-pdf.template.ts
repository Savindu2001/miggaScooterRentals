import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export async function renderAgreementPdf(pdfDoc: PDFDocument, booking: any): Promise<void> {
  const page = pdfDoc.addPage([612, 1008]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 960;

  // =========================
  // HEADER
  // =========================
  page.drawText('MIGGA SCOOTER RENTAL', {
    x: 50,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.9, 0.2, 0.3),
  });

  y -= 14;

  page.drawText('Hotel Junction,Sigiriya, Sri Lanka | WhatsApp: 0761794522 ', {
    x: 50,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });

  y -= 20;

  page.drawLine({
    start: { x: 50, y },
    end: { x: 562, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  y -= 20;

  // =========================
  // COLUMN SYSTEM (CUSTOMER / SCOOTER / BOOKING)
  // =========================

  const write = (x: number, yy: number, label: string, value: string) => {
    page.drawText(label, { x, y: yy, size: 8, font: boldFont });
    page.drawText(value || '-', { x: x + 95, y: yy, size: 8, font });
    return yy - 12;
  };

  const col1X = 50;
  const col2X = 230;
  const col3X = 410;

  let col1Y = y;
  let col2Y = y;
  let col3Y = y;

  // =========================
  // CUSTOMER
  // =========================
  page.drawText('CUSTOMER DETAILS', { x: col1X, y: col1Y, size: 9, font: boldFont });
  col1Y -= 14;

  col1Y = write(col1X, col1Y, 'Name:', booking.customerName);
  col1Y = write(col1X, col1Y, 'Passport:', booking.passportNumber);
  col1Y = write(col1X, col1Y, 'Nationality:', booking.nationality);
  col1Y = write(col1X, col1Y, 'WhatsApp:', booking.phone);
  col1Y = write(col1X, col1Y, 'Email:', booking.email);

  // =========================
  // SCOOTER
  // =========================
  page.drawText('SCOOTER DETAILS', { x: col2X, y: col2Y, size: 9, font: boldFont });
  col2Y -= 14;

  col2Y = write(
    col2X,
    col2Y,
    'Model:',
    booking.scooter ? `${booking.scooter.brand} ${booking.scooter.model}` : 'N/A'
  );

  col2Y = write(col2X, col2Y, 'Plate:', booking.scooter?.plateNumber ?? 'N/A');

  // =========================
  // BOOKING
  // =========================
  page.drawText('BOOKING DETAILS', { x: col3X, y: col3Y, size: 9, font: boldFont });
  col3Y -= 14;

  col3Y = write(
    col3X,
    col3Y,
    'Pickup:',
    booking.pickupDate ? new Date(booking.pickupDate).toDateString() : ''
  );

  col3Y = write(
    col3X,
    col3Y,
    'Return:',
    booking.returnDate ? new Date(booking.returnDate).toDateString() : ''
  );

  col3Y = write(col3X, col3Y, 'Days:', `${booking.rentalDays || 0}`);

  col3Y = write(col3X, col3Y, 'Total:', `Rs. ${Number(booking.totalAmount || 0).toFixed(2)}`);

  // =========================
  // ALIGN END OF COLUMNS
  // =========================
  y = Math.min(col1Y, col2Y, col3Y) - 15;

  page.drawLine({
    start: { x: 50, y },
    end: { x: 562, y },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  y -= 18;

  // =========================
  // RULES SECTION
  // =========================
  page.drawText('RULES & REGULATIONS', { x: 50, y, size: 11, font: boldFont });
  y -= 15;

  const rulesPath = path.join(
    process.cwd(),
    'src',
    'notifications',
    'templates',
    'rules.json'
  );

  let rulesList: any[] = [];
  if (fs.existsSync(rulesPath)) {
    rulesList = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
  }

  // =========================
  // FIXED RULES GRID (NO REDECLARATION)
  // =========================

  const rulesColLeftX = 50;
  const rulesColRightX = 320;
  const maxWidth = 240;

  let rulesLeftY = y;
  let rulesRightY = y;

  const drawRule = (x: number, rule: any, yy: number) => {
    const text = `${rule.title}: ${rule.description}`;

    const words = text.split(' ');
    let line = '';

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;

      if (font.widthOfTextAtSize(test, 7.5) > maxWidth) {
        page.drawText(line, { x, y: yy, size: 7.5, font });
        yy -= 10;
        line = word;
      } else {
        line = test;
      }
    }

    if (line) {
      page.drawText(line, { x, y: yy, size: 7.5, font });
      yy -= 12;
    }

    return yy;
  };

  const mid = Math.ceil(rulesList.length / 2);
  const leftRules = rulesList.slice(0, mid);
  const rightRules = rulesList.slice(mid);

  for (let i = 0; i < mid; i++) {
    if (leftRules[i]) rulesLeftY = drawRule(rulesColLeftX, leftRules[i], rulesLeftY);
    if (rightRules[i]) rulesRightY = drawRule(rulesColRightX, rightRules[i], rulesRightY);
  }

  y = Math.min(rulesLeftY, rulesRightY) - 20;

  // =========================
  // FOOTER
  // =========================
  let footerY = 150;

  page.drawLine({
    start: { x: 50, y: footerY + 60 },
    end: { x: 550, y: footerY + 60 },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  // OWNER
  page.drawText('OWNER / LESSOR', { x: 50, y: footerY + 40, size: 9, font: boldFont });
  page.drawText('Migga Scooter Rental', { x: 50, y: footerY + 25, size: 8, font });

  page.drawText('Authorized Digital Signature: MIGGA SCOOTER RENTAL', {
    x: 50,
    y: footerY + 10,
    size: 8,
    font,
  });

  page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
    x: 50,
    y: footerY - 5,
    size: 8,
    font,
  });

  // RENTER
  page.drawText('RENTER / LESSEE', { x: 350, y: footerY + 40, size: 9, font: boldFont });
  page.drawText(booking.customerName || '-', { x: 350, y: footerY + 25, size: 8, font });

  page.drawText('Digital Rental Signature:', {
    x: 350,
    y: footerY + 10,
    size: 8,
    font: boldFont,
  });

  // SIGNATURE
  if (booking.signatureImage) {
    try {
      const sigPath = path.join(process.cwd(), booking.signatureImage.replace(/^\//, ''));

      if (fs.existsSync(sigPath)) {
        const sigBytes = fs.readFileSync(sigPath);
        const sigImg = await pdfDoc.embedPng(sigBytes);

        page.drawImage(sigImg, {
          x: 350,
          y: footerY - 35,
          width: 130,
          height: 40,
        });
      }
    } catch (err) {
      console.error('Signature error:', err);
    }
  }

  page.drawText(
    `Date: ${booking.signedAt
      ? new Date(booking.signedAt).toLocaleDateString()
      : new Date().toLocaleDateString()
    }`,
    { x: 350, y: footerY - 55, size: 8, font }
  );

  page.drawText(
    `Time: ${booking.signedAt ? new Date(booking.signedAt).toLocaleTimeString() : ''
    }`,
    { x: 350, y: footerY - 70, size: 8, font }
  );

  // DISCLAIMER
  page.drawText(
    'This is a DIGITAL RENTAL AGREEMENT. By signing, the renter confirms full understanding and acceptance of all terms & conditions.',
    {
      x: 50,
      y: 30,
      size: 7.5,
      font,
      color: rgb(0.4, 0.4, 0.4),
    }
  );
}