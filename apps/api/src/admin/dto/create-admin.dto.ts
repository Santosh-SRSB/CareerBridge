import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAdminDto {
  @ApiProperty({ example: 'admin@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ops Admin' })
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: 'AdminSecure12' })
  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,}$/, {
    message: 'Password must be 12+ chars with upper, lower, and a number.',
  })
  password: string;
}
