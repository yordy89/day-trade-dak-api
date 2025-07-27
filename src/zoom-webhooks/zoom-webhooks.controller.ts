import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ZoomWebhooksService, ZoomWebhookEvent } from './zoom-webhooks.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@ApiTags('zoom-webhooks')
@Controller('zoom-webhooks')
export class ZoomWebhooksController {
  private readonly logger = new Logger(ZoomWebhooksController.name);

  constructor(
    private readonly zoomWebhooksService: ZoomWebhooksService,
    private readonly configService: ConfigService,
  ) {
    this.logger.log('ZoomWebhooksController initialized');
  }

  @Get('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test endpoint' })
  async test() {
    return { message: 'Zoom webhooks controller is working' };
  }

  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Zoom webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-zm-signature') signature: string,
    @Headers('x-zm-request-timestamp') timestamp: string,
  ) {
    // For URL validation from Zoom
    if (body.event === 'endpoint.url_validation') {
      const response = {
        plainToken: body.payload.plainToken,
        encryptedToken: crypto
          .createHmac('sha256', this.configService.get('ZOOM_WEBHOOK_SECRET_TOKEN'))
          .update(body.payload.plainToken)
          .digest('hex'),
      };
      return response;
    }

    // Validate webhook signature
    const isValid = this.zoomWebhooksService.validateWebhookSignature(
      JSON.stringify(body),
      signature,
      timestamp,
    );

    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const event: ZoomWebhookEvent = body;
    this.logger.log(`[ZOOM WEBHOOK CONTROLLER] Received Zoom webhook event: ${event.event}`);
    this.logger.log(`[ZOOM WEBHOOK CONTROLLER] Event payload: ${JSON.stringify(event.payload)}`);

    try {
      switch (event.event) {
        case 'meeting.started':
          this.logger.log(`[ZOOM WEBHOOK CONTROLLER] Processing meeting.started event`);
          await this.zoomWebhooksService.handleMeetingStarted(event);
          break;
          
        case 'meeting.ended':
          this.logger.log(`[ZOOM WEBHOOK CONTROLLER] Processing meeting.ended event`);
          await this.zoomWebhooksService.handleMeetingEnded(event);
          break;
          
        case 'meeting.participant_joined':
          await this.zoomWebhooksService.handleParticipantJoined(event);
          break;
          
        case 'meeting.participant_left':
          // Optional: Track participant leave events
          this.logger.log(`Participant left: ${JSON.stringify(event.payload)}`);
          break;
          
        default:
          this.logger.log(`Unhandled event type: ${event.event}`);
      }
    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      // Return 200 to prevent Zoom from retrying
    }

    return { status: 'ok' };
  }

  @Post('lock-meeting/:meetingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lock a meeting to prevent new participants' })
  async lockMeeting(@Param('meetingId') meetingId: string) {
    await this.zoomWebhooksService.lockMeeting(meetingId);
    return { message: 'Meeting locked successfully' };
  }
}