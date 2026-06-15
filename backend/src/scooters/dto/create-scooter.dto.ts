import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScooterStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateScooterDto {
  @ApiProperty({ example: 'SC-001' })
  @IsString()
  @IsNotEmpty()
  scooterCode: string;

  @ApiProperty({ example: 'Honda PCX 160 Premium' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Honda' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'PCX 160' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2024 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year: number;

  @ApiProperty({ example: 'Matte Black' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ example: 'MV-1234' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ example: 35.00 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  dailyRate: number;

  @ApiProperty({ example: 200.00 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  weeklyRate: number;

  @ApiProperty({ example: 700.00 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyRate: number;

  @ApiPropertyOptional({ enum: ScooterStatus, default: ScooterStatus.AVAILABLE })
  @IsEnum(ScooterStatus)
  @IsOptional()
  status?: ScooterStatus;

  @ApiPropertyOptional({ example: 'Excellent condition, full service history.' })
  @IsString()
  @IsOptional()
  description?: string;
}
