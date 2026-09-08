import { IsIn, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { REGISTRATION_PASSWORD_PATTERN } from '@careerbridge/shared';

const PASSWORD_MESSAGE =
  'Password must be at least 8 characters and include an uppercase letter, a number, and a special character.';

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  requestId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(4)
  otp!: string;

  @ApiProperty({ enum: ['CANDIDATE', 'EMPLOYER'] })
  @IsIn(['CANDIDATE', 'EMPLOYER'])
  accountType!: 'CANDIDATE' | 'EMPLOYER';

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: PASSWORD_MESSAGE })
  @Matches(REGISTRATION_PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;
}
