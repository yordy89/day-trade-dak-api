import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CampaignService } from '../services/campaign.service';
import { CreateCampaignDto } from '../dto/create-campaign.dto';
import { UpdateCampaignDto } from '../dto/update-campaign.dto';
import { SendTestEmailDto } from '../dto/send-test-email.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { CampaignStatus, CampaignType } from '../schemas/campaign.schema';

@ApiTags('email-marketing/campaigns')
@Controller('email-marketing/campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new email campaign' })
  async create(
    @Body() createCampaignDto: CreateCampaignDto,
    @Request() req: RequestWithUser,
  ) {
    return this.campaignService.create(
      createCampaignDto,
      req.user?.userId || req.user?._id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all campaigns with filters' })
  @ApiQuery({ name: 'status', required: false, enum: CampaignStatus })
  @ApiQuery({ name: 'type', required: false, enum: CampaignType })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('status') status?: CampaignStatus,
    @Query('type') type?: CampaignType,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      status,
      type,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    };

    const pagination = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    };

    return this.campaignService.findAll(
      req.user?.role === 'super_admin' ? undefined : req.user?.userId || req.user?._id,
      filters,
      pagination,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  async findOne(@Param('id') id: string) {
    return this.campaignService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campaign' })
  async update(
    @Param('id') id: string,
    @Body() updateCampaignDto: UpdateCampaignDto,
    @Request() req: RequestWithUser,
  ) {
    return this.campaignService.update(
      id,
      updateCampaignDto,
      req.user?.userId || req.user?._id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete campaign' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.campaignService.delete(id);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'Send campaign immediately' })
  async send(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.campaignService.sendCampaign(
      id,
      req.user?.userId || req.user?._id,
    );
  }

  @Post(':id/schedule')
  @ApiOperation({ summary: 'Schedule campaign for later' })
  async schedule(
    @Param('id') id: string,
    @Body('scheduledDate') scheduledDate: string,
    @Request() req: RequestWithUser,
  ) {
    return this.campaignService.scheduleCampaign(
      id,
      new Date(scheduledDate),
      req.user?.userId || req.user?._id,
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel scheduled campaign' })
  async cancel(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.campaignService.cancelCampaign(
      id,
      req.user?.userId || req.user?._id,
    );
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate campaign' })
  async duplicate(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.campaignService.duplicateCampaign(
      id,
      req.user?.userId || req.user?._id,
    );
  }

  @Post('test')
  @ApiOperation({ summary: 'Send test email' })
  async sendTest(
    @Body() sendTestEmailDto: SendTestEmailDto,
  ) {
    return this.campaignService.sendTestEmail(sendTestEmailDto);
  }
}