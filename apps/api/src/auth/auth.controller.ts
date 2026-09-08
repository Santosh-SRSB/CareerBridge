import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { PasswordLoginDto } from './dto/password-login.dto';
import { EmployerRegisterDto } from './dto/employer-register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @Post('otp/verify')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @Post('login')
  login(@Body() dto: PasswordLoginDto) {
    return this.auth.loginWithPassword(dto.identifier, dto.password, dto.accountType);
  }

  @Public()
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.loginAdmin(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post('employer/register')
  registerEmployer(@Body() dto: EmployerRegisterDto) {
    return this.auth.registerEmployer(dto);
  }

  @Public()
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Get('session')
  session(@CurrentUser() user: { id: string }) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(
    @CurrentUser() user: { id: string },
    @Body() body: { refreshToken?: string },
  ) {
    return this.auth.logout(user.id, body?.refreshToken);
  }
}
