import { IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  requestId: string;

  @ApiPropertyOptional({ description: 'Firebase ID token after client OTP confirm' })
  @IsOptional()
  @IsString()
  idToken?: string;

  @ApiPropertyOptional({ description: '4-digit OTP for mobile (MSG91), 6-digit for email, or local AUTH_DEV_OTP.' })
  @IsOptional()
  @IsString()
  @Length(4, 8)
  otp?: string;
}
