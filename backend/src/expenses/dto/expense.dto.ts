import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Maintenance' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 250.00 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: '2024-06-11' })
  @IsDateString()
  expenseDate: string;

  @ApiPropertyOptional({ example: 'Oil change for SC-001' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiPropertyOptional({ example: 'cuid_of_scooter' })
  @IsString()
  @IsOptional()
  scooterId?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() amount?: number;
  @ApiPropertyOptional() @IsDateString() @IsOptional() expenseDate?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() note?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() scooterId?: string;
}
