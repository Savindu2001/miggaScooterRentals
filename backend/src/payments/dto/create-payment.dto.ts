import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 'clxyz_booking_id' })
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @ApiProperty({ example: 'USD', default: 'USD' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ example: 'http://localhost:3001/payment/success' })
  @IsString()
  @IsNotEmpty()
  returnUrl: string;

  @ApiProperty({ example: 'http://localhost:3001/payment/cancel' })
  @IsString()
  @IsNotEmpty()
  cancelUrl: string;
}
