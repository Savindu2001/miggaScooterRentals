import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CustomerAccessDto {
  @ApiProperty({ example: 'MS-001-20240611' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^MS-\d{3}-\d{8}$/, {
    message: 'bookingId must be in format MS-XXX-YYYYMMDD',
  })
  bookingId: string;

  @ApiProperty({ example: 'N1234567' })
  @IsString()
  @IsNotEmpty()
  passportNumber: string;
}
