import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mongoose, { type ConnectOptions, type Connection } from 'mongoose';
import { AppLogger } from '../logging/app-logger';

export const MONGODB_URI_ENV_KEY = Symbol('MONGODB_URI_ENV_KEY');

@Injectable()
export class DatabaseService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger: AppLogger;
  private readonly uriEnvKey: string;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(
    config: ConfigService,
    logger: AppLogger,
    @Inject(MONGODB_URI_ENV_KEY) uriEnvKey: string,
  ) {
    this.config = config;
    this.logger = logger.withContext('MongoDB');
    this.uriEnvKey = uriEnvKey;

    const connection = mongoose.connection;
    connection.on('error', (error: Error) => this.logger.error('Connection error', error));
    connection.on('disconnected', () => this.logger.warn('Connection lost'));
    connection.on('reconnected', () => this.logger.log('Reconnected'));
  }

  private readonly config: ConfigService;

  async onApplicationBootstrap(): Promise<void> {
    void this.connectWithRetry();
  }

  getConnection(): Connection {
    return mongoose.connection;
  }

  getState(): string {
    return ['disconnected', 'connected', 'connecting', 'disconnecting'][
      mongoose.connection.readyState
    ] ?? 'unknown';
  }

  async isReady(): Promise<boolean> {
    if (mongoose.connection.readyState !== 1) return false;

    const database = mongoose.connection.db;
    if (database === undefined) return false;

    try {
      await database.admin().ping();
      return true;
    } catch (error) {
      this.logger.warn('Readiness ping failed', error);
      return false;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }

  private async connectWithRetry(attempt = 1): Promise<void> {
    if (this.stopped || mongoose.connection.readyState === 1) return;

    const uri = this.config.getOrThrow<string>(this.uriEnvKey);
    const options: ConnectOptions = {
      serverSelectionTimeoutMS: this.config.get<number>('MONGODB_SERVER_SELECTION_TIMEOUT_MS', 5000),
      autoIndex: this.config.get<string>('MONGODB_AUTO_INDEX', 'false') === 'true',
      retryWrites: true,
      retryReads: true,
    };

    try {
      await mongoose.connect(uri, options);
      this.logger.log(`Connected (attempt ${attempt})`);
    } catch (error) {
      this.logger.error(`Connection attempt ${attempt} failed`, error);
      const maxRetries = this.config.get<number>('MONGODB_MAX_RETRIES', 5);
      if (attempt > maxRetries) {
        this.logger.error('Connection retries exhausted; readiness will report unavailable');
        return;
      }

      const delay = this.config.get<number>('MONGODB_RETRY_DELAY_MS', 1000);
      this.retryTimer = setTimeout(() => void this.connectWithRetry(attempt + 1), delay);
    }
  }
}
