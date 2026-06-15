import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PickupType } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookingDto {
  @ApiProperty({ example: 'clxyz...' })
  @IsString()
  @IsNotEmpty()
  scooterId: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: 'British' })
  @IsString()
  @IsNotEmpty()
  nationality: string;

  @ApiProperty({ example: 'N1234567' })
  @IsString()
  @IsNotEmpty()
  passportNumber: string;

  @ApiProperty({ example: 'john.smith@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+447700900123' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '2024-06-15T00:00:00.000Z' })
  @IsDateString()
  pickupDate: string;

  @ApiProperty({ example: '2024-06-20T00:00:00.000Z' })
  @IsDateString()
  returnDate: string;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  rentalDays: number;

  @ApiProperty({ example: 175.00 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalAmount: number;

  @ApiProperty({ example: 100.00 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  securityDeposit: number;

  @ApiPropertyOptional({ enum: PickupType, default: PickupType.OFFICE })
  @IsEnum(PickupType)
  @IsOptional()
  pickupType?: PickupType;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryFee?: number;

  @ApiPropertyOptional({ example: 'clxyz_zone_id' })
  @IsString()
  @IsOptional()
  deliveryZoneId?: string;

  @ApiPropertyOptional({ example: 'Please keep the scooter clean.' })
  @IsString()
  @IsOptional()
  notes?: string;
}
