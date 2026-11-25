import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { isDuplicateKeyError } from '@orderflow/common';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto } from './dto';
import { USER_MODEL, type User, type UserModel, type UserRole } from './user.schema';

export interface PublicUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuthResult {
  accessToken: string;
  tokenType: 'Bearer';
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_MODEL) private readonly model: UserModel,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.model.findOne({ email }).exec();
    if (existing !== null) throw new ConflictException(`Email already registered: ${email}`);

    const rounds = this.config.get<number>('BCRYPT_ROUNDS', 10);
    const passwordHash = await bcrypt.hash(input.password, rounds);

    try {
      const user = await this.model.create({
        email,
        passwordHash,
        role: input.role ?? 'USER',
      });
      return this.toPublicUser(user);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(`Email already registered: ${email}`);
      }
      throw error;
    }
  }

  async login(input: LoginDto): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.model.findOne({ email }).exec();
    if (user === null) throw new UnauthorizedException('Invalid email or password');

    const matches = await bcrypt.compare(input.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException('Invalid email or password');

    const publicUser = this.toPublicUser(user);
    const accessToken = await this.jwt.signAsync({
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
    });

    return { accessToken, tokenType: 'Bearer', user: publicUser };
  }

  private toPublicUser(user: User): PublicUser {
    return { id: user._id, email: user.email, role: user.role };
  }
}
