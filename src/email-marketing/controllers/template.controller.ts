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
import { TemplateService } from '../services/template.service';
import { CreateTemplateDto } from '../dto/create-template.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/role.decorator';
import { Role } from '../../schemas/role';
import { RequestWithUser } from '../../types/request-with-user.interface';
import { TemplateCategory } from '../schemas/email-template.schema';

@ApiTags('email-marketing/templates')
@Controller('email-marketing/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@ApiBearerAuth()
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new email template' })
  async create(
    @Body() createTemplateDto: CreateTemplateDto,
    @Request() req: RequestWithUser,
  ) {
    return this.templateService.create(
      createTemplateDto,
      req.user?.userId || req.user?._id,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all templates with filters' })
  @ApiQuery({ name: 'category', required: false, enum: TemplateCategory })
  @ApiQuery({ name: 'isPublic', required: false, type: Boolean })
  @ApiQuery({ name: 'tags', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Request() req: RequestWithUser,
    @Query('category') category?: TemplateCategory,
    @Query('isPublic') isPublic?: string,
    @Query('tags') tags?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      category,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
      tags: tags ? tags.split(',') : undefined,
      userId: req.user?.userId || req.user?._id,
    };

    const pagination = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    };

    return this.templateService.findAll(filters, pagination);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default templates' })
  async getDefaultTemplates() {
    return this.templateService.getDefaultTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template by ID' })
  async findOne(@Param('id') id: string) {
    return this.templateService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update template' })
  async update(
    @Param('id') id: string,
    @Body() updateTemplateDto: Partial<CreateTemplateDto>,
    @Request() req: RequestWithUser,
  ) {
    return this.templateService.update(
      id,
      updateTemplateDto,
      req.user?.userId || req.user?._id,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete template' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.templateService.delete(
      id,
      req.user?.userId || req.user?._id,
    );
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate template' })
  async duplicate(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    return this.templateService.duplicate(
      id,
      req.user?.userId || req.user?._id,
    );
  }
}