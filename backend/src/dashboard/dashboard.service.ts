import { Injectable } from '@nestjs/common';
import { BookingStatus, PaymentStatus, ScooterStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { startOfMonth, endOfMonth, addDays, startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(startDate?: string, endDate?: string) {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const in3Days = addDays(now, 3);

    const rangeStart = startDate ? new Date(startDate) : monthStart;
    const rangeEnd = endDate ? new Date(endDate) : monthEnd;

    const bookingWhere: any = {};
    if (startDate || endDate) {
      bookingWhere.createdAt = {};
      if (startDate) bookingWhere.createdAt.gte = new Date(startDate);
      if (endDate) bookingWhere.createdAt.lte = new Date(endDate);
    }

    const [
      totalScooters,
      availableScooters,
      activeRentals,
      monthlyPayments,
      monthlyExpenses,
      upcomingReturns,
      bookingsByStatus,
      recentBookings,
    ] = await Promise.all([
      // Total scooters (not soft deleted)
      this.prisma.scooter.count({ where: { isDeleted: false } }),

      // Available scooters
      this.prisma.scooter.count({
        where: { isDeleted: false, status: ScooterStatus.AVAILABLE },
      }),

      // Active rentals (Picked Up)
      this.prisma.booking.count({
        where: { bookingStatus: BookingStatus.PICKED_UP },
      }),

      // Monthly revenue (completed payments)
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          paymentStatus: PaymentStatus.COMPLETED,
          paidAt: { gte: rangeStart, lte: rangeEnd },
        },
      }),

      // Monthly expenses
      this.prisma.expense.aggregate({
        _sum: { amount: true },
        where: {
          expenseDate: { gte: rangeStart, lte: rangeEnd },
        },
      }),

      // Upcoming returns (next 3 days)
      this.prisma.booking.findMany({
        where: {
          bookingStatus: BookingStatus.PICKED_UP,
          returnDate: { gte: startOfDay(now), lte: endOfDay(in3Days) },
        },
        include: { scooter: true },
        orderBy: { returnDate: 'asc' },
      }),

      // Bookings by status count
      this.prisma.booking.groupBy({
        by: ['bookingStatus'],
        where: bookingWhere,
        _count: { id: true },
      }),

      // Recent bookings
      this.prisma.booking.findMany({
        where: bookingWhere,
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { scooter: { select: { title: true } } },
      }),
    ]);

    const monthlyRevenue = Number(monthlyPayments._sum.amount ?? 0);
    const monthlyExpensesTotal = Number(monthlyExpenses._sum.amount ?? 0);
    const netProfit = monthlyRevenue - monthlyExpensesTotal;

    const statusMap: Record<string, number> = {};
    bookingsByStatus.forEach((item) => {
      statusMap[item.bookingStatus] = item._count.id;
    });

    return {
      overview: {
        totalScooters,
        availableScooters,
        activeRentals,
        reservedScooters: totalScooters - availableScooters - activeRentals,
      },
      financials: {
        monthlyRevenue,
        monthlyExpenses: monthlyExpensesTotal,
        netProfit,
        month: startDate && endDate ? `${startDate} to ${endDate}` : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      },
      bookingStats: statusMap,
      upcomingReturns,
      recentBookings,
    };
  }

  async getRevenueChart(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i);

    const data = await Promise.all(
      months.map(async (month) => {
        const start = new Date(targetYear, month, 1);
        const end = endOfMonth(start);

        const revenue = await this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            paymentStatus: PaymentStatus.COMPLETED,
            paidAt: { gte: start, lte: end },
          },
        });

        const expenses = await this.prisma.expense.aggregate({
          _sum: { amount: true },
          where: { expenseDate: { gte: start, lte: end } },
        });

        return {
          month: start.toLocaleString('default', { month: 'short' }),
          revenue: Number(revenue._sum.amount ?? 0),
          expenses: Number(expenses._sum.amount ?? 0),
        };
      }),
    );

    return { year: targetYear, data };
  }
}
