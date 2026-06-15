import { ApiPropertyOptional } from '@nestjs/swagger';
import { ScooterStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateScooterDto {
  @ApiPropertyOptional() @IsString() @IsOptional() scooterCode?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() title?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() brand?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() model?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsInt() @Min(2000) @IsOptional() year?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() color?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() plateNumber?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() dailyRate?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() weeklyRate?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() monthlyRate?: number;
  @ApiPropertyOptional({ enum: ScooterStatus }) @IsEnum(ScooterStatus) @IsOptional() status?: ScooterStatus;
  @ApiPropertyOptional() @IsString() @IsOptional() description?: string;
}

export class UpdateScooterStatusDto {
  @ApiPropertyOptional({ enum: ScooterStatus })
  @IsEnum(ScooterStatus)
  status: ScooterStatus;
}
