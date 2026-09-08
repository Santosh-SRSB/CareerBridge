import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthPurpose, OtpChannel, PREFERRED_LANGUAGES, REGISTRATION_PASSWORD_PATTERN } from '@careerbridge/shared';

const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';

export class RequestOtpDto {
  @ApiProperty({ enum: ['MOBILE', 'EMAIL'] })
  @IsIn(['MOBILE', 'EMAIL'])
  channel: OtpChannel;

  @ApiProperty({ enum: ['LOGIN', 'REGISTER', 'RESET_PASSWORD'] })
  @IsIn(['LOGIN', 'REGISTER', 'RESET_PASSWORD'])
  purpose: AuthPurpose;

  @ApiProperty({ enum: ['CANDIDATE', 'EMPLOYER'] })
  @IsIn(['CANDIDATE', 'EMPLOYER'])
  accountType: 'CANDIDATE' | 'EMPLOYER';

  @ApiPropertyOptional({ example: '+919876543210' })
  @ValidateIf((dto: RequestOtpDto) => dto.channel === 'MOBILE' || (dto.purpose === 'REGISTER' && Boolean(dto.phone)))
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Enter a valid mobile number with country code',
  })
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.channel === 'EMAIL' || (dto.purpose === 'REGISTER' && Boolean(dto.email)))
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER')
  @IsString()
  @MinLength(2, { message: 'Enter your name.' })
  @Matches(/^[a-zA-Z\s.'-]+$/, { message: 'Name should only contain letters and spaces.' })
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsIn([...PREFERRED_LANGUAGES], { message: 'Select a preferred language.' })
  preferredLanguage?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER' && dto.accountType === 'EMPLOYER')
  @IsString()
  @MinLength(2, { message: 'Enter your company name.' })
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER' && dto.accountType === 'EMPLOYER' && Boolean(dto.password))
  @IsString()
  @Matches(REGISTRATION_PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password?: string;

  /** Explicit WhatsApp interview-notification consent (candidates only). Default false. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;
}
