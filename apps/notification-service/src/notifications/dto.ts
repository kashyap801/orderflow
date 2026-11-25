import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { DELIVERY_STATUSES, NOTIFICATION_TYPES } from './notification.schema';

export class CreateNotificationDto {
  @ApiProperty({ example: 'customer-1' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  userId!: string;

  @ApiProperty({ enum: NOTIFICATION_TYPES })
  @IsEnum(NOTIFICATION_TYPES)
  type!: (typeof NOTIFICATION_TYPES)[number];

  @ApiProperty({ example: 'Order confirmed' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ example: 'Your order has been confirmed.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: 'Plain snapshots of cross-service data' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListNotificationsQueryDto {
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

  @ApiPropertyOptional({ example: 'customer-1' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  userId?: string;

  @ApiPropertyOptional({ enum: NOTIFICATION_TYPES })
  @IsOptional()
  @IsEnum(NOTIFICATION_TYPES)
  type?: (typeof NOTIFICATION_TYPES)[number];

  @ApiPropertyOptional({ enum: DELIVERY_STATUSES })
  @IsOptional()
  @IsEnum(DELIVERY_STATUSES)
  deliveryStatus?: (typeof DELIVERY_STATUSES)[number];

  @ApiPropertyOptional({ description: 'true for read, false for unread' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true'))
  @IsBoolean()
  isRead?: boolean;
}
