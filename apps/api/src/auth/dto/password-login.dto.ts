import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PasswordLoginDto {
  @ApiProperty({ example: '+919876543210' })
  @IsString()
  identifier: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Enter your password.' })
  password: string;

  @ApiPropertyOptional({ enum: ['CANDIDATE', 'EMPLOYER'] })
  @IsOptional()
  @IsIn(['CANDIDATE', 'EMPLOYER'])
  accountType?: 'CANDIDATE' | 'EMPLOYER';
}
