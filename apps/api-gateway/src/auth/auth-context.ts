import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthContext {
  userId?: string;
  role?: string;
  authenticated: boolean;
}

/** Resolves the JWT claims that JwtAuthMiddleware placed on the request. */
@Injectable()
export class AuthContextService {
  resolve(request: Request): AuthContext {
    const userId = request.header('x-user-id')?.trim();
    const role = request.header('x-user-role')?.trim();

    return {
      ...(userId !== undefined && userId.length > 0 ? { userId } : {}),
      ...(role !== undefined && role.length > 0 ? { role } : {}),
      authenticated: userId !== undefined && userId.length > 0,
    };
  }
}
