import { Controller, Post, Req, Res, Body, Headers } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request, Response } from 'express';

@Controller('payments')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  // **Create a checkout session**
  @Post('checkout')
  async createCheckoutSession(
    @Body() body: { userId: string; priceId: string },
  ) {
    return this.stripeService.createCheckoutSession(body.userId, body.priceId);
  }

  // **Stripe Webhook Handling**
  @Post('webhook')
  async stripeWebhook(
    @Req() request: Request,
    @Res() response: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      const rawBody = (request as any).rawBody; // ✅ Use manually stored raw body

      if (!rawBody) {
        throw new Error('Raw body is missing.');
      }

      await this.stripeService.handleWebhookEvent(signature, rawBody);
      response.sendStatus(200);
    } catch (error) {
      console.error('Stripe Webhook Error:', error.message);
      response.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
}
