import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Producer } from 'kafkajs';
import { AppLogger } from '../logging/app-logger';

@Injectable()
export class KafkaService implements OnApplicationShutdown {
  private readonly logger: AppLogger;
  private readonly config: ConfigService;
  private client?: Kafka;
  private producer?: Producer;
  private connected = false;

  constructor(config: ConfigService, logger: AppLogger) {
    this.config = config;
    this.logger = logger.withContext('Kafka');
  }

  get enabled(): boolean {
    return this.config.get<string>('KAFKA_ENABLED', 'false') === 'true';
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.logger.log('Disabled; skipping connection');
      return;
    }

    try {
      await this.getProducer().connect();
      this.connected = true;
      this.logger.log('Producer connected');
    } catch (error) {
      this.logger.error('Producer connection failed; readiness will report unavailable', error);
    }
  }

  getProducer(): Producer {
    if (!this.enabled) throw new Error('Kafka is disabled; set KAFKA_ENABLED=true first');
    if (this.producer === undefined) {
      const brokers = this.config
        .getOrThrow<string>('KAFKA_BROKERS')
        .split(',')
        .map((broker) => broker.trim())
        .filter((broker) => broker.length > 0);

      this.client = new Kafka({
        clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'orderflow'),
        brokers,
      });
      this.producer = this.client.producer();
    }
    return this.producer;
  }

  isReady(): boolean {
    if (!this.enabled) return true;
    return this.connected;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.producer === undefined) return;
    await this.producer.disconnect().catch((error: unknown) => {
      this.logger.warn('Producer disconnect failed', error);
    });
  }
}
