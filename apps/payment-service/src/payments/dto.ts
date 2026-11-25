import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PAYMENT_STATUSES } from './payment.schema';

export const SIMULATED_OUTCOMES = ['SUCCESS', 'FAILURE'] as const;
export type SimulatedOutcome = (typeof SIMULATED_OUTCOMES)[number];

export class ProcessPaymentDto {
  @ApiProperty({ example: 'order-1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  orderId!: string;

  @ApiProperty({ example: 'customer-1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  userId!: string;

  @ApiProperty({ description: 'Integer minor units', example: 6000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountCents!: number;

  @ApiProperty({ example: 'request-123' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  idempotencyKey!: string;

  @ApiPropertyOptional({ enum: SIMULATED_OUTCOMES, default: 'SUCCESS' })
  @IsOptional()
  @IsEnum(SIMULATED_OUTCOMES)
  simulate?: SimulatedOutcome;

  @ApiPropertyOptional({ example: 'Insufficient funds' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;
}

export class RefundPaymentDto {
  @ApiProperty({ description: 'Integer minor units', minimum: 1, example: 2000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountCents!: number;

  @ApiPropertyOptional({ example: 'Partial cancellation' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListPaymentsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsEnum(PAYMENT_STATUSES)
  status?: (typeof PAYMENT_STATUSES)[number];

  @ApiPropertyOptional({ example: 'order-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderId?: string;

  @ApiPropertyOptional({ example: 'customer-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  userId?: string;
}
