import { Transform } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['error', 'warn', 'info', 'debug', 'verbose'] as const;

function integer(defaultValue: number) {
  return ({ value }: { value: unknown }): number => {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : Number.NaN;
  };
}

export class EnvironmentVariables {
  @IsEnum(NODE_ENVIRONMENTS)
  NODE_ENV: (typeof NODE_ENVIRONMENTS)[number] = 'development';

  @IsOptional()
  @IsEnum(LOG_LEVELS)
  LOG_LEVEL: (typeof LOG_LEVELS)[number] = 'info';

  @Transform(integer(3001))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  @IsString()
  @MinLength(1)
  CORS_ORIGINS = 'http://localhost:5173';

  @IsString()
  @MinLength(1)
  MONGODB_URI_ORDER!: string;

  @Transform(integer(5000))
  @IsInt()
  @Min(100)
  MONGODB_SERVER_SELECTION_TIMEOUT_MS = 5000;

  @Transform(integer(5))
  @IsInt()
  @Min(0)
  @Max(20)
  MONGODB_MAX_RETRIES = 5;

  @Transform(integer(1000))
  @IsInt()
  @Min(100)
  MONGODB_RETRY_DELAY_MS = 1000;

  @IsOptional()
  @IsBooleanString()
  MONGODB_AUTO_INDEX = 'false';

  @IsOptional()
  @IsBooleanString()
  REDIS_ENABLED = 'false';

  @IsOptional()
  @IsString()
  @MinLength(1)
  REDIS_URL = 'redis://localhost:6379';

  @IsOptional()
  @IsBooleanString()
  KAFKA_ENABLED = 'false';

  @IsOptional()
  @IsString()
  @MinLength(1)
  KAFKA_BROKERS = 'localhost:9092';

  @IsOptional()
  @IsString()
  @MinLength(1)
  KAFKA_CLIENT_ID = 'orderflow';
}

export function validateEnvironment(raw: Record<string, unknown>): EnvironmentVariables {
  const environment = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
  });
  const errors = validateSync(environment, { forbidUnknownValues: false });

  if (errors.length > 0) {
    const details = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(`Invalid environment configuration: ${details.join('; ')}`);
  }

  return environment;
}
