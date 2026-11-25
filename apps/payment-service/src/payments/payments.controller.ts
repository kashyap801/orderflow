import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListPaymentsQueryDto, ProcessPaymentDto, RefundPaymentDto } from './dto';
import type { Payment, PaymentHistoryEntry } from './payment.schema';
import type { PaymentListResult } from './payments.service';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('process')
  @ApiOperation({ summary: 'Process a simulated payment; idempotencyKey prevents duplicates' })
  @ApiCreatedResponse({ description: 'Payment processed' })
  process(@Body() input: ProcessPaymentDto): Promise<Payment> {
    return this.payments.process(input);
  }

  @Get()
  @ApiOperation({ summary: 'List payments with pagination and filtering' })
  @ApiOkResponse({ description: 'Paginated payment list' })
  list(@Query() query: ListPaymentsQueryDto): Promise<PaymentListResult> {
    return this.payments.list(query);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Retrieve payment history for an order' })
  @ApiOkResponse({ description: 'Order payments' })
  findByOrder(@Param('orderId') orderId: string): Promise<Payment[]> {
    return this.payments.findByOrderId(orderId);
  }

  @Get('customer/:userId')
  @ApiOperation({ summary: 'Retrieve payment history for a customer' })
  @ApiOkResponse({ description: 'Customer payments' })
  findByCustomer(@Param('userId') userId: string): Promise<Payment[]> {
    return this.payments.findByCustomer(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve payment details' })
  @ApiOkResponse({ description: 'Payment details' })
  findById(@Param('id') id: string): Promise<Payment> {
    return this.payments.findById(id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Retrieve payment status history' })
  @ApiOkResponse({ description: 'Payment history' })
  history(@Param('id') id: string): Promise<PaymentHistoryEntry[]> {
    return this.payments.history(id);
  }

  @Post(':id/refunds')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a full or partial refund' })
  @ApiOkResponse({ description: 'Updated payment' })
  refund(@Param('id') id: string, @Body() input: RefundPaymentDto): Promise<Payment> {
    return this.payments.refund(id, input);
  }
}
