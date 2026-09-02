import { IsString, MinLength } from 'class-validator';

export class VerifyGstDto {
  @IsString()
  @MinLength(1, { message: 'Enter a GSTIN.' })
  gstin: string;
}
