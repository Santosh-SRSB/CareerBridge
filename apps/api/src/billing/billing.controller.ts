import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import { VerifyCheckoutDto } from './billing.dto';

type ReqWithRaw = Request & { rawBody?: Buffer };

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Guide §6.3 — public catalogue (display-safe fields only). */
  @Public()
  @Get('subscription-plans')
  listPublicPlans() {
    return this.billing.listPublicPlans();
  }

  @Get('employer/subscription')
  subscription(@CurrentUser() user: { id: string }) {
    return this.billing.getActiveSubscription(user.id);
  }

  @Post('employer/plans/:planId/order')
  createOrder(@CurrentUser() user: { id: string }, @Param('planId') planId: string) {
    return this.billing.createPlanOrder(user.id, planId);
  }

  @Post('employer/payments/verify')
  verify(@CurrentUser() user: { id: string }, @Body() body: VerifyCheckoutDto) {
    return this.billing.verifyCheckout(user.id, body);
  }

  /** Poll after UPI QR — Checkout handler may never fire on localhost. */
  @Post('employer/payments/:paymentId/sync')
  sync(@CurrentUser() user: { id: string }, @Param('paymentId') paymentId: string) {
    return this.billing.syncCheckoutStatus(user.id, paymentId);
  }

  @Public()
  @Post('webhooks/razorpay')
  webhook(
    @Req() req: ReqWithRaw,
    @Headers('x-razorpay-signature') signature: string | undefined,
  ) {
    return this.billing.handleWebhook(req.rawBody, signature);
  }
}
