import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthContextService, type AuthContext } from './auth/auth-context';
import { GATEWAY_ROUTES } from './proxy/proxy.middleware';

@ApiTags('Gateway')
@Controller('gateway')
export class GatewayController {
  constructor(private readonly authContext: AuthContextService) {}

  @Get('routes')
  @ApiOperation({ summary: 'List centralized proxy routes' })
  @ApiOkResponse({ description: 'Gateway route table' })
  routes(): typeof GATEWAY_ROUTES {
    return GATEWAY_ROUTES;
  }

  @Get('auth-context')
  @ApiOperation({
    summary: 'Authentication integration point (no token verification in Phase 3)',
  })
  @ApiOkResponse({ description: 'Resolved authentication context' })
  auth(@Req() request: Request): AuthContext {
    return this.authContext.resolve(request);
  }
}
