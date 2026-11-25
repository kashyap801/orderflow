import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateNotificationDto, ListNotificationsQueryDto } from './dto';
import type { Notification } from './notification.schema';
import type { NotificationListResult } from './notifications.service';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a notification and simulate email delivery' })
  @ApiCreatedResponse({ description: 'Notification created' })
  create(@Body() input: CreateNotificationDto): Promise<Notification> {
    return this.notifications.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications with pagination and filtering' })
  @ApiOkResponse({ description: 'Paginated notification list' })
  list(@Query() query: ListNotificationsQueryDto): Promise<NotificationListResult> {
    return this.notifications.list(query);
  }

  @Get('customer/:userId')
  @ApiOperation({ summary: 'Retrieve notification history for a customer' })
  @ApiOkResponse({ description: 'Customer notifications' })
  findByCustomer(@Param('userId') userId: string): Promise<Notification[]> {
    return this.notifications.findByCustomer(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a notification by ID' })
  @ApiOkResponse({ description: 'Notification details' })
  findById(@Param('id') id: string): Promise<Notification> {
    return this.notifications.findById(id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiOkResponse({ description: 'Updated notification' })
  markRead(@Param('id') id: string): Promise<Notification> {
    return this.notifications.markRead(id);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry simulated email delivery' })
  @ApiOkResponse({ description: 'Updated notification' })
  resend(@Param('id') id: string): Promise<Notification> {
    return this.notifications.resend(id);
  }
}
