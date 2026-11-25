import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BatchAvailabilityDto,
  CreateProductDto,
  ListProductsQueryDto,
  QuantityDto,
  UpdateProductDto,
} from './dto';
import type { AvailabilityResult, ProductListResult } from './products.service';
import { ProductsService } from './products.service';
import type { Product } from './product.schema';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a product' })
  @ApiCreatedResponse({ description: 'Product created' })
  create(@Body() input: CreateProductDto): Promise<Product> {
    return this.products.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List products with pagination, filtering and search' })
  @ApiOkResponse({ description: 'Paginated product list' })
  list(@Query() query: ListProductsQueryDto): Promise<ProductListResult> {
    return this.products.list(query);
  }

  @Post('availability/batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check availability for multiple products' })
  @ApiOkResponse({ description: 'Availability results' })
  checkBatch(@Body() input: BatchAvailabilityDto): Promise<AvailabilityResult[]> {
    return this.products.checkAvailabilityBatch(input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a product by ID' })
  @ApiOkResponse({ description: 'Product details' })
  findById(@Param('id') id: string): Promise<Product> {
    return this.products.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiOkResponse({ description: 'Updated product' })
  update(@Param('id') id: string, @Body() input: UpdateProductDto): Promise<Product> {
    return this.products.update(id, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a product' })
  @ApiOkResponse({ description: 'Deactivated product' })
  deactivate(@Param('id') id: string): Promise<Product> {
    return this.products.deactivate(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Check available inventory for a product' })
  @ApiOkResponse({ description: 'Availability result' })
  checkAvailability(
    @Param('id') id: string,
    @Query() query: QuantityDto,
  ): Promise<AvailabilityResult> {
    return this.products.checkAvailability(id, query.quantity);
  }

  @Post(':id/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atomically reserve stock; fails on insufficient availability' })
  @ApiOkResponse({ description: 'Product with updated quantities' })
  reserve(@Param('id') id: string, @Body() input: QuantityDto): Promise<Product> {
    return this.products.reserve(id, input.quantity);
  }

  @Post(':id/release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release previously reserved stock' })
  @ApiOkResponse({ description: 'Product with updated quantities' })
  release(@Param('id') id: string, @Body() input: QuantityDto): Promise<Product> {
    return this.products.release(id, input.quantity);
  }

  @Post(':id/restock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Increase available stock' })
  @ApiOkResponse({ description: 'Product with updated quantities' })
  restock(@Param('id') id: string, @Body() input: QuantityDto): Promise<Product> {
    return this.products.restock(id, input.quantity);
  }
}
