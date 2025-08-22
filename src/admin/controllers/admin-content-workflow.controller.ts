import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../constants';
import { AdminContentWorkflowService, VideoUploadOptionsDto } from '../services/admin-content-workflow.service';
import { WorkflowStatus } from '../../content/schemas/content-video.schema';

@Controller('admin/content/workflow')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminContentWorkflowController {
  constructor(
    private readonly workflowService: AdminContentWorkflowService,
  ) {}

  @Post('videos/upload/initiate')
  async initiateUploadWithWorkflow(
    @Body() body: VideoUploadOptionsDto,
    @Req() req,
  ) {
    return this.workflowService.initiateVideoUploadWithWorkflow(body, req.user);
  }

  @Post('videos/upload/complete')
  async completeUploadWithWorkflow(
    @Body() body: {
      videoId: string;
      uploadId: string;
      parts: Array<{ partNumber: number; etag: string }>;
    },
  ) {
    return this.workflowService.completeUploadWithWorkflow(
      body.videoId,
      body.uploadId,
      body.parts,
    );
  }

  @Post('videos/:id/process-hls')
  async triggerHLSProcessing(@Param('id') id: string) {
    return this.workflowService.manuallyTriggerHLSProcessing(id);
  }

  @Put('videos/:id/status')
  async updateWorkflowStatus(
    @Param('id') id: string,
    @Body() body: {
      status: WorkflowStatus;
      notes?: string;
    },
    @Req() req,
  ) {
    return this.workflowService.updateWorkflowStatus(
      id,
      body.status,
      req.user.email,
      body.notes,
    );
  }

  @Post('videos/:id/assign')
  async assignVideo(
    @Param('id') id: string,
    @Body() body: {
      assigneeEmail: string;
    },
    @Req() req,
  ) {
    return this.workflowService.assignVideo(
      id,
      body.assigneeEmail,
      req.user.email,
    );
  }

  @Post('videos/:id/approve')
  async approveVideo(
    @Param('id') id: string,
    @Body() body: {
      notes?: string;
      publish?: boolean;
    },
    @Req() req,
  ) {
    const result = await this.workflowService.updateWorkflowStatus(
      id,
      WorkflowStatus.APPROVED,
      req.user.email,
      body.notes,
    );

    if (body.publish) {
      await this.workflowService.updateWorkflowStatus(
        id,
        WorkflowStatus.PUBLISHED,
        req.user.email,
        'Auto-published after approval',
      );
    }

    return result;
  }

  @Post('videos/:id/reject')
  async rejectVideo(
    @Param('id') id: string,
    @Body() body: {
      reason: string;
      suggestions?: string;
    },
    @Req() req,
  ) {
    const notes = `Reason: ${body.reason}${body.suggestions ? `\nSuggestions: ${body.suggestions}` : ''}`;
    return this.workflowService.updateWorkflowStatus(
      id,
      WorkflowStatus.REJECTED,
      req.user.email,
      notes,
    );
  }

  @Get('videos/:id/versions')
  async getVideoVersions(@Param('id') id: string) {
    return this.workflowService.getVideoVersions(id);
  }

  @Post('videos/:id/create-version')
  async createNewVersion(
    @Param('id') parentId: string,
    @Body() body: VideoUploadOptionsDto,
    @Req() req,
  ) {
    // Set parent video ID for versioning
    body.parentVideoId = parentId;
    return this.workflowService.initiateVideoUploadWithWorkflow(body, req.user);
  }
}