import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthContext {
  userId?: string;
  hasBearerToken: boolean;
}

/**
 * Authentication integration point only. Phase 3 forwards credentials to
 * downstream services but does not verify JWTs or enforce RBAC.
 */
@Injectable()
export class AuthContextService {
  resolve(request: Request): AuthContext {
    const userId = request.header('x-user-id')?.trim();
    const authorization = request.header('authorization');
    const hasBearerToken =
      authorization !== undefined && /^Bearer\s+\S+/i.test(authorization.trim());
    return {
      ...(userId !== undefined && userId.length > 0 ? { userId } : {}),
      hasBearerToken,
    };
  }
}
