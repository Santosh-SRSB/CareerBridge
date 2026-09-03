import { IsIn, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordLoginDto {
  @ApiProperty({ example: 'you@example.com' })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Enter your password.' })
  password: string;

  @ApiProperty({ enum: ['CANDIDATE', 'EMPLOYER', 'SUPER_ADMIN', 'ADMIN'] })
  @IsIn(['CANDIDATE', 'EMPLOYER', 'SUPER_ADMIN', 'ADMIN'])
  accountType: 'CANDIDATE' | 'EMPLOYER' | 'SUPER_ADMIN' | 'ADMIN';
}
