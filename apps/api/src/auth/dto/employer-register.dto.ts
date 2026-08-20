import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PERSON_NAME_PATTERN, REGISTRATION_PASSWORD_PATTERN } from '@careerbridge/shared';

export class EmployerRegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  companyName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2, { message: 'Enter the contact person name.' })
  @MaxLength(80)
  @Matches(PERSON_NAME_PATTERN, { message: 'Enter a valid name using letters only.' })
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
