import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDeliveryZoneDto {
  @ApiProperty({ example: 'Zone 1 - Town Centre' })
  @IsString()
  @IsNotEmpty()
  zoneName: string;

  @ApiProperty({ example: 1.0, description: 'Distance in km' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distanceKm: number;

  @ApiProperty({ example: 700.00, description: 'Delivery fee in local currency' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fee: number;
}

export class UpdateDeliveryZoneDto {
  @ApiPropertyOptional() @IsString() @IsOptional() zoneName?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() distanceKm?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() fee?: number;
}
