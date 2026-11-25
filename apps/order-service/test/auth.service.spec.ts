import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../src/auth/auth.service';
import type { User, UserModel } from '../src/auth/user.schema';

const config = { get: jest.fn(() => 10) } as unknown as ConfigService;
const jwt = {
  signAsync: jest.fn(async () => 'signed-token'),
} as unknown as JwtService;

function fakeModel(existing: User | null = null) {
  const model = {
    findOne: jest.fn(() => ({ exec: async () => existing })),
    create: jest.fn(async (input: Partial<User>) => ({
      _id: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    })),
  } as unknown as UserModel;
  return model;
}

describe('AuthService', () => {
  it('registers a user without exposing the password hash', async () => {
    const model = fakeModel();
    const service = new AuthService(model, jwt, config);

    const user = await service.register({ email: 'User@Example.com', password: 'password123' });

    expect(user).toEqual({ id: 'user-1', email: 'user@example.com', role: 'USER' });
    expect(createInput(model).email).toBe('user@example.com');
    expect(createInput(model).passwordHash).not.toBe('password123');
  });

  it('rejects duplicate email registration', async () => {
    const existing = {
      _id: 'user-1',
      email: 'user@example.com',
      passwordHash: 'hash',
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    const service = new AuthService(fakeModel(existing), jwt, config);

    await expect(
      service.register({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with a valid password and issues a JWT', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    const existing = {
      _id: 'user-1',
      email: 'user@example.com',
      passwordHash,
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    const service = new AuthService(fakeModel(existing), jwt, config);

    const result = await service.login({ email: 'user@example.com', password: 'password123' });

    expect(result.accessToken).toBe('signed-token');
    expect(result.user).toEqual({ id: 'user-1', email: 'user@example.com', role: 'ADMIN' });
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'user@example.com',
      role: 'ADMIN',
    });
  });

  it('rejects an invalid password', async () => {
    const existing = {
      _id: 'user-1',
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('different-password', 10),
      role: 'USER',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    const service = new AuthService(fakeModel(existing), jwt, config);

    await expect(
      service.login({ email: 'user@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createInput(model: UserModel): Partial<User> {
  return (model.create as jest.Mock).mock.calls[0]?.[0] as Partial<User>;
}
