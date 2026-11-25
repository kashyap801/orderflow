import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, type Consumer, type Producer } from 'kafkajs';
import { AppLogger } from '../logging/app-logger';

@Injectable()
export class KafkaService implements OnApplicationShutdown {
  private readonly logger: AppLogger;
  private readonly config: ConfigService;
  private readonly consumers = new Map<string, Consumer>();
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

  private getClient(): Kafka {
    if (this.client === undefined) {
      const brokers = this.config
        .getOrThrow<string>('KAFKA_BROKERS')
        .split(',')
        .map((broker) => broker.trim())
        .filter((broker) => broker.length > 0);

      this.client = new Kafka({
        clientId: this.config.get<string>('KAFKA_CLIENT_ID', 'orderflow'),
        brokers,
      });
    }
    return this.client;
  }

  getProducer(): Producer {
    if (!this.enabled) throw new Error('Kafka is disabled; set KAFKA_ENABLED=true first');
    if (this.producer === undefined) this.producer = this.getClient().producer();
    return this.producer;
  }

  getConsumer(groupId: string): Consumer {
    if (!this.enabled) throw new Error('Kafka is disabled; set KAFKA_ENABLED=true first');
    let consumer = this.consumers.get(groupId);
    if (consumer === undefined) {
      consumer = this.getClient().consumer({
        groupId,
        sessionTimeout: 10000,
      });
      this.consumers.set(groupId, consumer);
    }
    return consumer;
  }

  async publish(topic: string, value: unknown, key?: string): Promise<void> {
    if (!this.enabled) return;
    await this.getProducer().send({
      topic,
      messages: [{ ...(key === undefined ? {} : { key }), value: JSON.stringify(value) }],
    });
  }

  async consume<T>(
    topic: string,
    groupId: string,
    handler: (event: T) => Promise<void>,
  ): Promise<void> {
    if (!this.enabled) return;
    const consumer = this.getConsumer(groupId);
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (message.value === null) return;
        try {
          const event = JSON.parse(message.value.toString()) as T;
          await handler(event);
        } catch (error) {
          this.logger.error(`Failed to handle event from ${topic}`, error);
        }
      },
    });
  }

  isReady(): boolean {
    if (!this.enabled) return true;
    return this.connected;
  }

  async onApplicationShutdown(): Promise<void> {
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect().catch((error: unknown) => {
        this.logger.warn('Consumer disconnect failed', error);
      });
    }
    this.consumers.clear();

    if (this.producer === undefined) return;
    await this.producer.disconnect().catch((error: unknown) => {
      this.logger.warn('Producer disconnect failed', error);
    });
  }
}
