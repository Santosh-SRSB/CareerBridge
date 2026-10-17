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

  @ApiPropertyOptional({ description: '6-digit OTP for email OTP, or local AUTH_DEV_OTP. Mobile Firebase OTP uses idToken instead.' })
  @IsOptional()
  @IsString()
  @Length(4, 8)
  otp?: string;
}
