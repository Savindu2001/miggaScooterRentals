import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateExtensionDto {
  @ApiProperty({ example: '2024-06-25T00:00:00.000Z' })
  @IsDateString()
  requestedUntil: string;

  @ApiProperty({ example: 'I need the scooter for a few more days due to my flight delay.' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReviewExtensionDto {
  @ApiPropertyOptional({ example: 'Extension approved. Please return by the new date.' })
  @IsString()
  @IsOptional()
  reviewNote?: string;
}
