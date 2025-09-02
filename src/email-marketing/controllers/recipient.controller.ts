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
} from '@nestjs/swagger';
import { RecipientService } from '../services/recipient.service';
import { RecipientFilterDto, PreviewRecipientsDto } from '../dto/recipient-filter.dto';
import { CreateSegmentDto } from '../dto/create-segment.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';

@ApiTags('email-marketing/recipients')
@Controller('email-marketing/recipients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class RecipientController {
  constructor(private readonly recipientService: RecipientService) {}

  @Post('preview')
  @ApiOperation({ summary: 'Preview filtered recipients' })
  async previewRecipients(
    @Body() filters: PreviewRecipientsDto,
  ) {
    const recipients = await this.recipientService.getFilteredRecipients(
      filters,
      filters.customEmails,
    );

    if (filters.countOnly) {
      return { count: recipients.count };
    }

    return {
      recipients: recipients.emails.slice(0, 100), // Limit preview to 100
      count: recipients.count,
    };
  }

  @Post('count')
  @ApiOperation({ summary: 'Get recipient count for filters' })
  async getRecipientCount(
    @Body() filters: RecipientFilterDto,
  ) {
    const count = await this.recipientService.getRecipientCount(filters);
    return { count };
  }
}

@ApiTags('email-marketing/segments')
@Controller('email-marketing/segments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class SegmentController {
  constructor(private readonly recipientService: RecipientService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new recipient segment' })
  async create(
    @Body() createSegmentDto: CreateSegmentDto,
    @Request() req: RequestWithUser,
  ) {
    return this.recipientService.createSegment(
      createSegmentDto,
      req.user?.userId || req.user?._id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all segments' })
  async findAll(@Request() req: RequestWithUser) {
    const userId = req.user?.role === 'super_admin' 
      ? undefined 
      : req.user?.userId || req.user?._id;
    return this.recipientService.findAllSegments(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get segment by ID' })
  async findOne(@Param('id') id: string) {
    return this.recipientService.findSegment(id);
  }

  @Get(':id/recipients')
  @ApiOperation({ summary: 'Get recipients for a segment' })
  async getSegmentRecipients(@Param('id') id: string) {
    return this.recipientService.getSegmentRecipients(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update segment' })
  async update(
    @Param('id') id: string,
    @Body() updateSegmentDto: Partial<CreateSegmentDto>,
    @Request() req: RequestWithUser,
  ) {
    return this.recipientService.updateSegment(
      id,
      updateSegmentDto,
      req.user?.userId || req.user?._id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete segment' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    return this.recipientService.deleteSegment(id);
  }
}