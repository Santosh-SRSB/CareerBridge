import { IsString, MinLength } from 'class-validator';

export class VerifyCheckoutDto {
  @IsString()
  @MinLength(8)
  paymentId!: string;

  @IsString()
  @MinLength(8)
  razorpayOrderId!: string;

  @IsString()
  @MinLength(8)
  razorpayPaymentId!: string;

  @IsString()
  @MinLength(8)
  razorpaySignature!: string;
}
