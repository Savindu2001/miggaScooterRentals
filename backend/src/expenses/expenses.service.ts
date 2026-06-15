import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

const INCLUDE = {
  createdBy: { select: { id: true, name: true, email: true } },
  scooter: { select: { id: true, title: true, plateNumber: true, scooterCode: true } },
};

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateExpenseDto, userId: string) {
    return this.prisma.expense.create({
      data: {
        category: dto.category,
        amount: dto.amount,
        expenseDate: new Date(dto.expenseDate),
        note: dto.note,
        createdById: userId,
        scooterId: dto.scooterId ?? null,
      },
      include: INCLUDE,
    });
  }

  async findAll(params: {
    category?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }) {
    const { category, startDate, endDate, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (startDate && endDate) {
      where.expenseDate = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { expenseDate: 'desc' },
        include: INCLUDE,
      }),
      this.prisma.expense.count({ where }),
    ]);

    const totalAmount = data.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), totalAmount },
    };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id }, include: INCLUDE });
    if (!expense) throw new NotFoundException(`Expense ${id} not found`);
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.expenseDate) data.expenseDate = new Date(dto.expenseDate);
    if (dto.scooterId === null || dto.scooterId === '') data.scooterId = null;
    return this.prisma.expense.update({ where: { id }, data, include: INCLUDE });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
    return { message: 'Expense deleted successfully' };
  }
}
