import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService, type AuthResult, type PublicUser } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a simple USER or ADMIN demo account' })
  @ApiCreatedResponse({ description: 'Registered user' })
  register(@Body() input: RegisterDto): Promise<PublicUser> {
    return this.auth.register(input);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in and receive a JWT' })
  @ApiOkResponse({ description: 'JWT access token' })
  login(@Body() input: LoginDto): Promise<AuthResult> {
    return this.auth.login(input);
  }
}
