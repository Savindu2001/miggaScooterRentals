import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

/**
 * Generates a booking ID in the format MS-001-YYYYMMDD
 * Uses a global counter stored in BookingCounter table (thread-safe via transaction).
 */
export async function generateBookingId(prisma: PrismaClient): Promise<string> {
  const today = format(new Date(), 'yyyyMMdd');

  const counter = await prisma.bookingCounter.upsert({
    where: { id: 1 },
    update: { count: { increment: 1 } },
    create: { id: 1, count: 1 },
  });

  const sequence = String(counter.count).padStart(3, '0');
  return `MS-${sequence}-${today}`;
}
