import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContentVideo, ContentVideoDocument, WorkflowStatus } from '../schemas/content-video.schema';
import { EmailService } from '../../email/email.service';
import { videoUploadedTemplate, VideoUploadedData } from '../../email/templates/video-uploaded.template';
import { videoEditedTemplate, VideoEditedData } from '../../email/templates/video-edited.template';
import { videoApprovedTemplate, VideoApprovedData } from '../../email/templates/video-approved.template';
import { videoRejectedTemplate, VideoRejectedData } from '../../email/templates/video-rejected.template';

@Injectable()
export class VideoNotificationService {
  private readonly logger = new Logger(VideoNotificationService.name);
  private readonly frontendUrl: string;

  constructor(
    @InjectModel(ContentVideo.name)
    private contentVideoModel: Model<ContentVideoDocument>,
    private readonly emailService: EmailService,
  ) {
    this.frontendUrl = process.env.FRONTEND_URL || 'https://admin.daytradedak.com';
  }

  async sendVideoUploadedNotification(
    videoId: string,
    recipients: string[],
  ): Promise<void> {
    try {
      const video = await this.contentVideoModel.findById(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const downloadUrl = `${this.frontendUrl}/api/v1/admin/content/videos/${videoId}/download-url`;
      const previewUrl = `${this.frontendUrl}/content/preview/${videoId}`;
      const dashboardUrl = `${this.frontendUrl}/content`;

      const fileSize = this.formatFileSize(video.fileSize);

      for (const recipient of recipients) {
        const emailData: VideoUploadedData = {
          recipientName: this.extractName(recipient),
          videoTitle: video.title,
          uploadedBy: video.uploadedBy,
          fileSize,
          duration: video.metadata?.duration ? this.formatDuration(video.metadata.duration) : undefined,
          editNotes: video.editNotes,
          downloadUrl,
          previewUrl,
          dashboardUrl,
        };

        const html = videoUploadedTemplate(emailData);
        await this.emailService.sendBasicEmail(
          recipient,
          `New Video Uploaded: ${video.title}`,
          html,
        );

        // Log notification in video history
        await this.logNotification(videoId, 'upload', [recipient], 'sent');
      }

      this.logger.log(`Video upload notifications sent for ${videoId} to ${recipients.length} recipients`);
    } catch (error) {
      this.logger.error('Failed to send video upload notification', error);
      await this.logNotification(videoId, 'upload', recipients, 'failed', error.message);
      throw error;
    }
  }

  async sendVideoEditedNotification(
    videoId: string,
    recipients: string[],
  ): Promise<void> {
    try {
      const video = await this.contentVideoModel.findById(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const parentVideo = video.parentVideoId 
        ? await this.contentVideoModel.findById(video.parentVideoId)
        : null;

      const downloadUrl = `${this.frontendUrl}/api/v1/admin/content/videos/${videoId}/download-url`;
      const compareUrl = `${this.frontendUrl}/content/compare/${video.parentVideoId}/${videoId}`;
      const dashboardUrl = `${this.frontendUrl}/content/review/${videoId}`;

      for (const recipient of recipients) {
        const emailData: VideoEditedData = {
          recipientName: this.extractName(recipient),
          videoTitle: video.title,
          editedBy: video.uploadedBy,
          originalUploader: parentVideo?.uploadedBy || 'Unknown',
          versionNumber: video.version,
          editNotes: video.editNotes,
          changes: video.editNotes, // Could be enhanced with specific change tracking
          downloadUrl,
          compareUrl,
          dashboardUrl,
        };

        const html = videoEditedTemplate(emailData);
        await this.emailService.sendBasicEmail(
          recipient,
          `Video Edited: ${video.title} (Version ${video.version})`,
          html,
        );

        await this.logNotification(videoId, 'edit', [recipient], 'sent');
      }

      this.logger.log(`Video edit notifications sent for ${videoId} to ${recipients.length} recipients`);
    } catch (error) {
      this.logger.error('Failed to send video edit notification', error);
      await this.logNotification(videoId, 'edit', recipients, 'failed', error.message);
      throw error;
    }
  }

  async sendVideoApprovedNotification(
    videoId: string,
    recipients: string[],
  ): Promise<void> {
    try {
      const video = await this.contentVideoModel.findById(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const viewUrl = `${this.frontendUrl}/videos/${videoId}`;
      const dashboardUrl = `${this.frontendUrl}/content`;

      const publishStatus = video.isPublished 
        ? 'published' 
        : video.publishedAt 
          ? 'scheduled' 
          : 'draft';

      for (const recipient of recipients) {
        const emailData: VideoApprovedData = {
          recipientName: this.extractName(recipient),
          videoTitle: video.title,
          approvedBy: video.approvedBy || 'Admin',
          approvalDate: video.approvedAt?.toLocaleDateString() || new Date().toLocaleDateString(),
          publishStatus: publishStatus as 'published' | 'scheduled' | 'draft',
          publishDate: video.publishedAt?.toLocaleDateString(),
          finalVersion: video.version,
          viewUrl,
          dashboardUrl,
          reviewNotes: video.reviewNotes,
        };

        const html = videoApprovedTemplate(emailData);
        await this.emailService.sendBasicEmail(
          recipient,
          `🎉 Video Approved: ${video.title}`,
          html,
        );

        await this.logNotification(videoId, 'approval', [recipient], 'sent');
      }

      this.logger.log(`Video approval notifications sent for ${videoId} to ${recipients.length} recipients`);
    } catch (error) {
      this.logger.error('Failed to send video approval notification', error);
      await this.logNotification(videoId, 'approval', recipients, 'failed', error.message);
      throw error;
    }
  }

  async sendVideoRejectedNotification(
    videoId: string,
    recipients: string[],
  ): Promise<void> {
    try {
      const video = await this.contentVideoModel.findById(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      const editUrl = `${this.frontendUrl}/content/edit/${videoId}`;
      const dashboardUrl = `${this.frontendUrl}/content`;
      const supportUrl = `${this.frontendUrl}/support`;

      for (const recipient of recipients) {
        const emailData: VideoRejectedData = {
          recipientName: this.extractName(recipient),
          videoTitle: video.title,
          rejectedBy: video.rejectedBy || 'Reviewer',
          rejectionDate: video.rejectedAt?.toLocaleDateString() || new Date().toLocaleDateString(),
          rejectionReason: video.rejectionReason || 'Quality standards not met',
          suggestions: video.reviewNotes,
          currentVersion: video.version,
          editUrl,
          dashboardUrl,
          supportUrl,
        };

        const html = videoRejectedTemplate(emailData);
        await this.emailService.sendBasicEmail(
          recipient,
          `Video Needs Revision: ${video.title}`,
          html,
        );

        await this.logNotification(videoId, 'rejection', [recipient], 'sent');
      }

      this.logger.log(`Video rejection notifications sent for ${videoId} to ${recipients.length} recipients`);
    } catch (error) {
      this.logger.error('Failed to send video rejection notification', error);
      await this.logNotification(videoId, 'rejection', recipients, 'failed', error.message);
      throw error;
    }
  }

  async sendProcessingCompleteNotification(
    videoId: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    try {
      const video = await this.contentVideoModel.findById(videoId);
      if (!video) {
        throw new Error('Video not found');
      }

      // Get notification recipients
      const recipients = video.notificationSettings?.onUpload || [];
      if (recipients.length === 0) {
        return;
      }

      const subject = success 
        ? `✅ Video Processing Complete: ${video.title}`
        : `❌ Video Processing Failed: ${video.title}`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${success ? '✅ Processing Complete' : '❌ Processing Failed'}</h2>
          <p>Hello,</p>
          <p>
            ${success 
              ? `Your video "${video.title}" has been successfully processed and is ready for viewing.`
              : `Unfortunately, processing failed for your video "${video.title}".`
            }
          </p>
          ${error ? `<p style="color: red;">Error: ${error}</p>` : ''}
          <p>
            <a href="${this.frontendUrl}/content/preview/${videoId}" 
               style="background-color: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              ${success ? 'View Video' : 'View Details'}
            </a>
          </p>
        </div>
      `;

      for (const recipient of recipients) {
        await this.emailService.sendBasicEmail(recipient, subject, html);
      }

      await this.logNotification(
        videoId, 
        'processing', 
        recipients, 
        'sent',
        success ? undefined : error,
      );
    } catch (error) {
      this.logger.error('Failed to send processing notification', error);
    }
  }

  private async logNotification(
    videoId: string,
    type: string,
    sentTo: string[],
    status: 'sent' | 'failed',
    error?: string,
  ): Promise<void> {
    try {
      await this.contentVideoModel.findByIdAndUpdate(videoId, {
        $push: {
          notificationHistory: {
            type,
            sentTo,
            sentAt: new Date(),
            status,
            error,
          },
        },
      });
    } catch (err) {
      this.logger.error('Failed to log notification', err);
    }
  }

  private extractName(email: string): string {
    const parts = email.split('@')[0].split('.');
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  async notifyBasedOnWorkflowStatus(
    videoId: string,
    previousStatus: WorkflowStatus,
    newStatus: WorkflowStatus,
  ): Promise<void> {
    const video = await this.contentVideoModel.findById(videoId);
    if (!video || !video.notificationSettings) {
      return;
    }

    // Determine which notification to send based on status transition
    if (newStatus === WorkflowStatus.PENDING_EDIT && video.notificationSettings.onUpload?.length > 0) {
      await this.sendVideoUploadedNotification(videoId, video.notificationSettings.onUpload);
    } else if (newStatus === WorkflowStatus.PENDING_REVIEW && video.notificationSettings.onEdit?.length > 0) {
      await this.sendVideoEditedNotification(videoId, video.notificationSettings.onEdit);
    } else if (newStatus === WorkflowStatus.APPROVED && video.notificationSettings.onApproval?.length > 0) {
      await this.sendVideoApprovedNotification(videoId, video.notificationSettings.onApproval);
    } else if (newStatus === WorkflowStatus.REJECTED) {
      // Send rejection notification to the uploader
      const uploaderEmail = await this.getUploaderEmail(video.uploadedBy);
      if (uploaderEmail) {
        await this.sendVideoRejectedNotification(videoId, [uploaderEmail]);
      }
    }
  }

  private async getUploaderEmail(uploadedBy: string): Promise<string | null> {
    // Extract email from uploadedBy string if it contains one
    const emailMatch = uploadedBy.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return emailMatch ? emailMatch[1] : null;
  }
}