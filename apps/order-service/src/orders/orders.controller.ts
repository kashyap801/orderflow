import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderEventPublisher } from '../events/order-event-publisher';
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
  UpdatePaymentStatusDto,
} from './dto';
import type { Order, OrderHistoryEntry } from './order.schema';
import type { OrderListResult } from './orders.service';
import { OrdersService } from './orders.service';

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    @Optional() private readonly events?: OrderEventPublisher,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create an order; prices are resolved from Inventory, never from the request',
  })
  @ApiCreatedResponse({ description: 'Order created' })
  async create(@Body() input: CreateOrderDto): Promise<Order> {
    const order = await this.orders.create(input);
    await this.events?.publishCreated(order);
    return order;
  }

  @Get()
  @ApiOperation({ summary: 'List orders with pagination and filtering' })
  @ApiOkResponse({ description: 'Paginated order list' })
  list(@Query() query: ListOrdersQueryDto): Promise<OrderListResult> {
    return this.orders.list(query);
  }

  @Get('customer/:userId')
  @ApiOperation({ summary: 'Retrieve all orders for a customer' })
  @ApiOkResponse({ description: 'Customer orders' })
  findByCustomer(@Param('userId') userId: string): Promise<Order[]> {
    return this.orders.findByCustomer(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve an order by ID' })
  @ApiOkResponse({ description: 'Order details' })
  findById(@Param('id') id: string): Promise<Order> {
    return this.orders.findById(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Retrieve order status history' })
  @ApiOkResponse({ description: 'Status history' })
  history(@Param('id') id: string): Promise<OrderHistoryEntry[]> {
    return this.orders.history(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status with transition validation' })
  @ApiOkResponse({ description: 'Updated order' })
  updateStatus(@Param('id') id: string, @Body() input: UpdateOrderStatusDto): Promise<Order> {
    return this.orders.updateStatus(id, input);
  }

  @Patch(':id/payment-status')
  @ApiOperation({ summary: 'Update order payment status' })
  @ApiOkResponse({ description: 'Updated order' })
  updatePaymentStatus(
    @Param('id') id: string,
    @Body() input: UpdatePaymentStatusDto,
  ): Promise<Order> {
    return this.orders.updatePaymentStatus(id, input.paymentStatus);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order from a cancellable status' })
  @ApiOkResponse({ description: 'Cancelled order' })
  cancel(@Param('id') id: string): Promise<Order> {
    return this.orders.cancel(id);
  }
}
