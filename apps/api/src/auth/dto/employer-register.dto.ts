import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { REGISTRATION_PASSWORD_PATTERN } from '@careerbridge/shared';

export class EmployerRegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  contactName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  industry: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  city: string;

  @ApiProperty()
  @IsString()
  @Matches(REGISTRATION_PASSWORD_PATTERN, {
    message:
      'Password must be at least 8 characters, include an uppercase letter, and use only letters and numbers.',
  })
  password: string;
}
