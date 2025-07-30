import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { EmailService } from '../email/email.service';

class SubscribeDto {
  email: string;
}

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly emailService: EmailService) {}

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(@Body() dto: SubscribeDto) {
    const { email } = dto;

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return {
        success: false,
        message: 'Please provide a valid email address',
      };
    }

    try {
      // Get newsletter list ID from environment variable
      const newsletterListId = parseInt(
        process.env.BREVO_NEWSLETTER_LIST_ID || '0',
      );

      if (newsletterListId === 0) {
        console.warn('Newsletter list ID not configured in environment variables');
        // Still return success to not break the user experience
        return {
          success: true,
          message: 'Thank you for subscribing to our newsletter!',
        };
      }

      // Add contact to Brevo newsletter list
      await this.emailService.addContactToList(email, [newsletterListId], {
        // Can add additional attributes if needed
        SOURCE: 'website_footer',
        SUBSCRIBED_DATE: new Date().toISOString(),
      });

      return {
        success: true,
        message: 'Thank you for subscribing to our newsletter!',
      };
    } catch (error) {
      console.error('Newsletter subscription error:', error);

      // Check if it's a duplicate contact error
      if (error.response?.data?.code === 'duplicate_parameter') {
        return {
          success: true,
          message: 'You are already subscribed to our newsletter!',
        };
      }

      return {
        success: false,
        message: 'An error occurred. Please try again later.',
      };
    }
  }
}