import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { KafkaService } from '../infra/kafka.service';
import { RedisService } from '../infra/redis.service';
import { AppLogger } from '../logging/app-logger';

export type DependencyStatus = 'up' | 'down';

export interface DependencyHealth {
  status: DependencyStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthChecks {
  mongodb?: DependencyHealth;
  redis: DependencyHealth;
  kafka: DependencyHealth;
}

export interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResult {
  status: 'ok' | 'error';
  uptimeSeconds: number;
  timestamp: string;
  checks: HealthChecks;
}

@Injectable()
export class HealthService {
  private readonly logger: AppLogger;

  constructor(
    private readonly redis: RedisService,
    private readonly kafka: KafkaService,
    config: ConfigService,
    logger: AppLogger,
    @Optional() private readonly database?: DatabaseService,
  ) {
    this.logger = logger.withContext('Health');
    if (config.get<string>('NODE_ENV') !== 'test') {
      this.logger.log(`Initialised; MongoDB=${database?.getState() ?? 'disabled'}`);
    }
  }

  getLiveness(): LivenessResult {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessResult> {
    const checks: HealthChecks = {
      ...(this.database === undefined ? {} : { mongodb: await this.timeCheck(this.database) }),
      redis: await this.timeCheck(this.redis),
      kafka: this.kafka.isReady() ? { status: 'up' } : { status: 'down' },
    };

    const healthy = Object.values(checks).every((check) => check.status === 'up');
    return {
      status: healthy ? 'ok' : 'error',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async timeCheck(service: {
    isReady(): boolean | Promise<boolean>;
  }): Promise<DependencyHealth> {
    const startedAt = Date.now();
    try {
      const ready = await service.isReady();
      const latencyMs = Date.now() - startedAt;
      return ready ? { status: 'up', latencyMs } : { status: 'down', latencyMs };
    } catch (error) {
      this.logger.warn('Dependency check threw', error);
      return {
        status: 'down',
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
