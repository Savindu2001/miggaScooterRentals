import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Create PayPal order for a booking' })
  @ApiResponse({ status: 201, description: 'PayPal order created, returns approval URL' })
  createOrder(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createOrder(dto);
  }

  @Public()
  @Post('capture/:orderId')
  @ApiOperation({ summary: 'Capture PayPal payment after customer approval (public)' })
  @ApiResponse({ status: 200, description: 'Payment captured, booking confirmed' })
  captureOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.captureOrder(orderId);
  }

  @Public()
  @Post('create-order-public')
  @ApiOperation({ summary: 'Create PayPal order for a booking (public — customer use)' })
  @ApiResponse({ status: 201, description: 'PayPal order created, returns approval URL' })
  createOrderPublic(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createOrder(dto);
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'PayPal webhook handler (public endpoint)' })
  handleWebhook(@Body() payload: any) {
    return this.paymentsService.handleWebhook(payload);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List all payments' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentsService.findAll({ page, limit, search, startDate, endDate });
  }

  @Get('booking/:bookingId')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get payments for a specific booking' })
  getBookingPayments(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getBookingPayments(bookingId);
  }
}
