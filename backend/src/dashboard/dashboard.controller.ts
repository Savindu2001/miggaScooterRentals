import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.STAFF)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard stats: overview, financials, upcoming returns' })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getStats(startDate, endDate);
  }

  @Get('revenue-chart')
  @ApiOperation({ summary: 'Get monthly revenue vs expenses chart data' })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getRevenueChart(@Query('year') year?: number) {
    return this.dashboardService.getRevenueChart(year);
  }
}
