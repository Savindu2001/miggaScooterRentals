import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, PickupType } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateBookingDto {
  @ApiPropertyOptional() @IsString() @IsOptional() customerName?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() nationality?: string;
  @ApiPropertyOptional() @IsEmail() @IsOptional() email?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() phone?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() pickupDate?: string;
  @ApiPropertyOptional() @IsDateString() @IsOptional() returnDate?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(1) @IsOptional() rentalDays?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() totalAmount?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() securityDeposit?: number;
  @ApiPropertyOptional({ enum: BookingStatus }) @IsEnum(BookingStatus) @IsOptional() bookingStatus?: BookingStatus;
  @ApiPropertyOptional({ enum: PickupType }) @IsEnum(PickupType) @IsOptional() pickupType?: PickupType;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() deliveryFee?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() deliveryZoneId?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() notes?: string;
}

export class UpdateBookingStatusDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  bookingStatus: BookingStatus;
}

export class VerifyQrDto {
  @ApiPropertyOptional({ example: '{"bookingId":"MS-001-20240611","verificationToken":"uuid"}' })
  @IsString()
  qrData: string;
}

export class SignAgreementDto {
  @ApiPropertyOptional({ description: 'Base64-encoded signature PNG or file upload' })
  @IsString()
  @IsOptional()
  signatureBase64?: string;
}
