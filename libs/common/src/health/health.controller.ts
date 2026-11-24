import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Process liveness' })
  @ApiResponse({ status: 200, description: 'Process is running' })
  liveness(): unknown {
    return this.health.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Dependency readiness' })
  @ApiResponse({ status: 200, description: 'All enabled dependencies are ready' })
  @ApiResponse({ status: 503, description: 'One or more required dependencies are unavailable' })
  async readiness(@Res({ passthrough: true }) response: Response): Promise<unknown> {
    const result = await this.health.getReadiness();
    if (result.status === 'error') response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
