import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthPurpose, OtpChannel, PREFERRED_LANGUAGES, REGISTRATION_PASSWORD_PATTERN } from '@careerbridge/shared';

const PASSWORD_MESSAGE =
  'Password must be at least 8 characters, include an uppercase letter, and use only letters and numbers.';

export class RequestOtpDto {
  @ApiProperty({ enum: ['MOBILE', 'EMAIL'] })
  @IsIn(['MOBILE', 'EMAIL'])
  channel: OtpChannel;

  @ApiProperty({ enum: ['LOGIN', 'REGISTER'] })
  @IsIn(['LOGIN', 'REGISTER'])
  purpose: AuthPurpose;

  @ApiPropertyOptional({ enum: ['CANDIDATE', 'EMPLOYER'] })
  @IsOptional()
  @IsIn(['CANDIDATE', 'EMPLOYER'])
  accountType?: 'CANDIDATE' | 'EMPLOYER';

  @ApiPropertyOptional({ example: '+919876543210' })
  @ValidateIf((dto: RequestOtpDto) => dto.channel === 'MOBILE' || dto.purpose === 'REGISTER')
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Enter a valid mobile number with country code',
  })
  phone?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.channel === 'EMAIL' || dto.purpose === 'REGISTER')
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER')
  @IsString()
  @MinLength(2, { message: 'Enter your name.' })
  fullName?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER')
  @IsString()
  @MinLength(2, { message: 'Enter your location.' })
  location?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.purpose === 'REGISTER' && dto.accountType !== 'EMPLOYER')
  @IsString()
  @IsIn([...PREFERRED_LANGUAGES], { message: 'Select a preferred language.' })
  preferredLanguage?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.accountType === 'EMPLOYER')
  @IsString()
  @MinLength(2, { message: 'Enter your company name.' })
  companyName?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => dto.accountType === 'EMPLOYER')
  @IsString()
  @MinLength(2, { message: 'Enter your industry.' })
  industry?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto: RequestOtpDto) => Boolean(dto.password))
  @IsString()
  @Matches(REGISTRATION_PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password?: string;
}
