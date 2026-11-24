import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AppLogger } from '../logging/app-logger';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger: AppLogger;
  private readonly config: ConfigService;
  private client?: Redis;
  private connected = false;

  constructor(config: ConfigService, logger: AppLogger) {
    this.config = config;
    this.logger = logger.withContext('Redis');
  }

  get enabled(): boolean {
    return this.config.get<string>('REDIS_ENABLED', 'false') === 'true';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Disabled; skipping connection');
      return;
    }

    try {
      await this.getClient().connect();
      this.connected = true;
      this.logger.log('Connected');
    } catch (error) {
      this.logger.error('Connection failed; readiness will report unavailable', error);
    }
  }

  getClient(): Redis {
    if (!this.enabled) throw new Error('Redis is disabled; set REDIS_ENABLED=true first');
    if (this.client === undefined) {
      this.client = new Redis(this.config.getOrThrow<string>('REDIS_URL'), {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (times: number) => Math.min(times * 200, 2000),
      });
      this.client.on('error', (error: Error) => this.logger.error('Client error', error));
    }
    return this.client;
  }

  async isReady(): Promise<boolean> {
    if (!this.enabled) return true;
    return this.connected && this.client?.status === 'ready';
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client === undefined) return;
    if (this.client.status === 'ready') await this.client.quit().catch(() => undefined);
    else this.client.disconnect();
  }
}
