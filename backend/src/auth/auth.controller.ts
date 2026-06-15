import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CustomerAccessDto } from './dto/customer-access.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Staff login with email and password' })
  @ApiResponse({ status: 200, description: 'JWT access token returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('customer-access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer access — retrieve booking token using bookingId + passport number',
  })
  @ApiResponse({ status: 200, description: 'Customer JWT token returned with booking summary' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  customerAccess(@Body() dto: CustomerAccessDto) {
    return this.authService.customerAccess(dto);
  }
}
