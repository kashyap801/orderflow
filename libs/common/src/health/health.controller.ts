import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  async readiness(): Promise<unknown> {
    const result = await this.health.getReadiness();
    if (result.status === 'error') {
      throw new ServiceUnavailableException('Dependency readiness check failed');
    }
    return result;
  }
}
