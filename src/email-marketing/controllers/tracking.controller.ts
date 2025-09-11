import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

@Controller('email-marketing/tracking')
export class TrackingController {
  private readonly logger = new Logger(TrackingController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Track email open via pixel
   * URL: /email-tracking/open/:campaignId/:recipientId.png
   */
  @Get('open/:campaignId/:recipientEmail.png')
  async trackOpen(
    @Param('campaignId') campaignId: string,
    @Param('recipientEmail') recipientEmail: string,
    @Res() res: Response,
  ) {
    try {
      // Decode the email address (it might be URL encoded)
      // The .png extension is part of the route, not the param
      const decodedEmail = decodeURIComponent(recipientEmail);
      
      this.logger.log(`[OPEN TRACKING] Starting - Campaign: ${campaignId}, Email: ${decodedEmail}`);
      
      // Log the open event
      await this.analyticsService.trackEmailOpen(campaignId, decodedEmail);
      
      this.logger.log(`[OPEN TRACKING] Completed - Campaign: ${campaignId}, Email: ${decodedEmail}`);

      // Return a 1x1 transparent pixel
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      );

      res.setHeader('Content-Type', 'image/gif');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.status(HttpStatus.OK).send(pixel);
    } catch (error) {
      this.logger.error('Error tracking email open:', error);
      // Still return the pixel even if tracking fails
      const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64',
      );
      res.setHeader('Content-Type', 'image/gif');
      res.status(HttpStatus.OK).send(pixel);
    }
  }

  /**
   * Track link click and redirect
   * URL: /email-tracking/click/:campaignId/:recipientId?url=targetUrl
   */
  @Get('click/:campaignId/:recipientEmail')
  async trackClick(
    @Param('campaignId') campaignId: string,
    @Param('recipientEmail') recipientEmail: string,
    @Query('url') targetUrl: string,
    @Query('linkId') linkId: string,
    @Res() res: Response,
  ) {
    try {
      // Decode the email address
      const decodedEmail = decodeURIComponent(recipientEmail);
      
      // Log the click event
      await this.analyticsService.trackEmailClick(campaignId, decodedEmail, linkId);
      
      this.logger.log(`Link clicked - Campaign: ${campaignId}, Recipient: ${decodedEmail}, Link: ${linkId}`);

      // Redirect to the actual URL
      if (targetUrl) {
        // Decode the URL if it was encoded
        const decodedUrl = decodeURIComponent(targetUrl);
        res.redirect(HttpStatus.MOVED_PERMANENTLY, decodedUrl);
      } else {
        // If no URL provided, redirect to homepage
        res.redirect(HttpStatus.MOVED_PERMANENTLY, 'https://daytradedak.com');
      }
    } catch (error) {
      this.logger.error('Error tracking link click:', error);
      // Still redirect even if tracking fails
      if (targetUrl) {
        const decodedUrl = decodeURIComponent(targetUrl);
        res.redirect(HttpStatus.MOVED_PERMANENTLY, decodedUrl);
      } else {
        res.redirect(HttpStatus.MOVED_PERMANENTLY, 'https://daytradedak.com');
      }
    }
  }

  /**
   * Track unsubscribe
   * URL: /email-tracking/unsubscribe/:campaignId/:recipientId
   */
  @Get('unsubscribe/:campaignId/:recipientEmail')
  async trackUnsubscribe(
    @Param('campaignId') campaignId: string,
    @Param('recipientEmail') recipientEmail: string,
    @Res() res: Response,
  ) {
    try {
      // Decode the email address
      const decodedEmail = decodeURIComponent(recipientEmail);
      
      await this.analyticsService.trackEmailUnsubscribe(campaignId, decodedEmail);
      
      this.logger.log(`Unsubscribe - Campaign: ${campaignId}, Recipient: ${decodedEmail}`);

      // Redirect to unsubscribe confirmation page
      res.redirect(HttpStatus.MOVED_PERMANENTLY, 'https://daytradedak.com/unsubscribe-success');
    } catch (error) {
      this.logger.error('Error tracking unsubscribe:', error);
      res.redirect(HttpStatus.MOVED_PERMANENTLY, 'https://daytradedak.com/unsubscribe-success');
    }
  }
}