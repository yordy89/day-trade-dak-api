import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  Body,
  Headers,
  UseGuards,
  Delete,
  Param,
  Query,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PricingService } from './pricing.service';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from 'src/guards/jwt-auth-guard';
import { RequestWithUser } from 'src/auth/auth.interfaces';
import { SubscriptionPlan } from 'src/users/user.dto';
import { EventRegistrationsService } from 'src/event/event-registration.service';

@Controller('payments')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly pricingService: PricingService,
    private eventRegistrationsService: EventRegistrationsService,
    private configService: ConfigService,
  ) {}

  // **Create a checkout session**
  @Post('checkout')
  async createCheckoutSession(
    @Body() body: { userId: string; priceId: string },
  ) {
    return this.stripeService.createCheckoutSession(body.userId, body.priceId);
  }

  @Post('vip-event-checkout')
  async createVipEventCheckoutSession(
    @Body()
    body: {
      eventId: string;
      priceId: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      promoCode?: string;
    },
  ) {
    await this.eventRegistrationsService.validateNotRegistered(
      body.eventId,
      body.email,
    );

    return this.stripeService.createVipEventCheckoutSession(body);
  }

  // **Create event checkout session (NEW)**
  @Post('event-checkout')
  async createEventCheckoutSession(
    @Body()
    body: {
      eventId: string;
      firstName: string;
      lastName: string;
      email: string;
      phoneNumber?: string;
      additionalInfo?: object;
      userId?: string;
      paymentMethod?: 'card' | 'klarna' | 'afterpay';
    },
  ) {
    // Validate user is not already registered
    await this.eventRegistrationsService.validateNotRegistered(
      body.eventId,
      body.email,
    );

    return this.stripeService.createEventCheckoutSession(body);
  }

  // **Create classes checkout session (NEW)**
  @UseGuards(JwtAuthGuard)
  @Post('classes-checkout')
  async createClassesCheckoutSession(
    @Req() req: RequestWithUser,
    @Body() body: { userId?: string; paymentMethod?: 'card' | 'klarna' | 'afterpay' },
  ) {
    const userId = body.userId || req.user._id.toString();
    const paymentMethod = body.paymentMethod || 'card';
    return this.stripeService.createClassesCheckoutSession(
      userId,
      paymentMethod,
    );
  }

  // **Stripe Webhook Handling**
  @Post('webhook')
  async stripeWebhook(
    @Req() request: Request,
    @Res() response: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    console.log('🔔 Webhook endpoint hit at /payments/webhook');
    console.log('🔑 Stripe signature present:', !!signature);
    
    try {
      const rawBody = (request as any).rawBody; // ✅ Use manually stored raw body
      console.log('📦 Raw body present:', !!rawBody);
      console.log('📦 Raw body type:', typeof rawBody);
      console.log('📦 Raw body length:', rawBody ? rawBody.length : 0);

      if (!rawBody) {
        console.error('❌ Raw body is missing');
        throw new Error('Raw body is missing.');
      }

      console.log('🚀 Calling handleWebhookEvent...');
      await this.stripeService.handleWebhookEvent(signature, rawBody);
      console.log('✅ Webhook processed successfully');
      response.sendStatus(200);
    } catch (error) {
      console.error('❌ Stripe Webhook Error:', error.message);
      console.error('Stack trace:', error.stack);
      response.status(400).send(`Webhook Error: ${error.message}`);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Delete('cancel/:subscription')
  async cancelSubscription(
    @Param('subscription') subscription: string,
    @Req() req: RequestWithUser,
  ) {
    return this.stripeService.cancelSubscription(
      req.user._id.toString(),
      subscription as SubscriptionPlan,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/users/:userId/cancel/:plan')
  async cancelUserSubscription(
    @Param('userId') userId: string,
    @Param('plan') plan: string,
  ) {
    return this.stripeService.cancelSubscription(
      userId,
      plan as SubscriptionPlan,
      true,
    );
  }

  // **Get subscription details**
  @UseGuards(JwtAuthGuard)
  @Get('subscriptions')
  async getSubscriptionDetails(@Req() req: RequestWithUser) {
    return this.stripeService.getSubscriptionDetails(req.user._id.toString());
  }

  // **Create customer portal session**
  @UseGuards(JwtAuthGuard)
  @Post('customer-portal')
  async createCustomerPortal(@Req() req: RequestWithUser) {
    return this.stripeService.createCustomerPortalSession(
      req.user._id.toString(),
    );
  }

  // **Get payment history**
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getPaymentHistory(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.stripeService.getPaymentHistory(
      req.user._id.toString(),
      limitNumber,
    );
  }

  // **Update subscription**
  @UseGuards(JwtAuthGuard)
  @Post('update-subscription')
  async updateSubscription(
    @Req() req: RequestWithUser,
    @Body() body: { currentPlan: SubscriptionPlan; newPriceId: string },
  ) {
    return this.stripeService.updateSubscription(
      req.user._id.toString(),
      body.currentPlan,
      body.newPriceId,
    );
  }

  // **Calculate price with conditional pricing**
  @UseGuards(JwtAuthGuard)
  @Post('calculate-price')
  async calculatePrice(
    @Req() req: RequestWithUser,
    @Body() body: { plan: SubscriptionPlan },
  ) {
    return this.pricingService.calculatePrice(
      req.user._id.toString(),
      body.plan,
    );
  }

  // **Get all plan prices for user**
  @UseGuards(JwtAuthGuard)
  @Get('plan-prices')
  async getAllPlanPrices(@Req() req: RequestWithUser) {
    return this.pricingService.calculatePricesForAllPlans(
      req.user._id.toString(),
    );
  }

  // **Create enhanced checkout session**
  @UseGuards(JwtAuthGuard)
  @Post('checkout/enhanced')
  async createEnhancedCheckout(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      plan: SubscriptionPlan;
      paymentMethods?: string[];
      metadata?: Record<string, string>;
    },
  ) {
    return this.stripeService.createEnhancedCheckoutSession(
      req.user._id.toString(),
      body.plan,
      {
        paymentMethods: body.paymentMethods,
        metadata: body.metadata,
      },
    );
  }

  // **Create weekly manual subscription**
  @UseGuards(JwtAuthGuard)
  @Post('checkout/live-weekly-manual')
  async createWeeklyManualCheckout(@Req() req: RequestWithUser) {
    return this.stripeService.createWeeklyManualSubscription(
      req.user._id.toString(),
    );
  }

  // **Create weekly recurring subscription**
  @UseGuards(JwtAuthGuard)
  @Post('checkout/live-weekly-recurring')
  async createWeeklyRecurringCheckout(@Req() req: RequestWithUser) {
    return this.stripeService.createWeeklyRecurringSubscription(
      req.user._id.toString(),
    );
  }

  // **Get subscription history**
  @UseGuards(JwtAuthGuard)
  @Get('subscription-history')
  async getSubscriptionHistory(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.stripeService.getSubscriptionHistory(
      req.user._id.toString(),
      limitNumber,
    );
  }

  // **Get checkout session details (for success page)**
  @Get('checkout-session/:sessionId')
  async getCheckoutSession(@Param('sessionId') sessionId: string) {
    return this.stripeService.getCheckoutSession(sessionId);
  }

  // **Redirect to checkout session URL**
  @Get('checkout-redirect/:sessionId')
  async redirectToCheckout(
    @Param('sessionId') sessionId: string,
    @Res() res: Response,
  ) {
    try {
      const session = await this.stripeService.getCheckoutSessionUrl(sessionId);
      if (session.url) {
        res.redirect(session.url);
      } else {
        res.status(400).send('Checkout session URL not found');
      }
    } catch (error) {
      res.status(400).send('Invalid checkout session');
    }
  }

  // **Confirm payment and get subscription status**
  @Post('confirm-payment')
  async confirmPayment(@Body() body: { sessionId: string }) {
    const session = await this.stripeService.getCheckoutSession(body.sessionId);

    if (session.status === 'complete' && session.user) {
      return {
        success: true,
        message: 'Payment successful! Your subscription is now active.',
        subscription: {
          plan: session.metadata?.plan,
          status: 'active',
        },
        user: session.user,
        redirectUrl: '/dashboard',
      };
    } else {
      return {
        success: false,
        message:
          'Payment is still being processed. Please check back in a moment.',
        redirectUrl: '/dashboard',
      };
    }
  }

  // **Payment success page**
  @Get('success')
  async paymentSuccessPage(
    @Query('session_id') sessionId: string,
    @Query('plan') plan: string,
    @Res() res: Response,
  ) {
    // Serve the payment success HTML page
    const path = require('path');
    res.sendFile(path.join(__dirname, 'payment-success.html'));
  }

  // **Get public pricing for a specific plan**
  @Get('public-pricing/:plan')
  async getPublicPricing(@Param('plan') plan: string) {
    // Return base price without user-specific discounts
    const pricingRule = this.pricingService.getPricingRule(
      plan as SubscriptionPlan,
    );
    if (!pricingRule) {
      throw new Error(`No pricing found for plan: ${plan}`);
    }
    return {
      plan: pricingRule.plan,
      basePrice: pricingRule.basePrice,
      currency: pricingRule.currency,
    };
  }

  // **TEST: Manually update subscription**
  @UseGuards(JwtAuthGuard)
  @Post('test-update-subscription')
  async testUpdateSubscription(
    @Req() req: RequestWithUser,
    @Body() body: { plan: SubscriptionPlan },
  ) {
    const userId = req.user._id.toString();

    // Manually update the subscription
    const userService = (this.stripeService as any).userService;

    // Remove existing subscription of same type
    await userService.updateUser(userId, {
      $pull: { subscriptions: { plan: body.plan } },
    });

    // Add new subscription
    await userService.updateUser(userId, {
      $push: {
        subscriptions: { plan: body.plan },
      },
    });

    return {
      success: true,
      message: `Subscription ${body.plan} added successfully`,
    };
  }
}
