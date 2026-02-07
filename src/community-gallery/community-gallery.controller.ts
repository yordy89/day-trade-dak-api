import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CommunityGalleryService } from './community-gallery.service';
import { CreateGalleryItemDto, UpdateGalleryItemDto, ReorderGalleryItemsDto } from './dto/create-gallery-item.dto';
import { GalleryItemType } from './gallery-item.schema';
import { JwtAuthGuard } from '../guards/jwt-auth-guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '../constants';

@ApiTags('Community Gallery')
@Controller('community-gallery')
export class CommunityGalleryController {
  constructor(private readonly galleryService: CommunityGalleryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all gallery items (public) with pagination' })
  async findAll(
    @Query('type') type?: GalleryItemType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);
    return this.galleryService.findAllPaginated(type, pageNum, limitNum);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all gallery items including inactive (admin only)' })
  async findAllAdmin(@Query('type') type?: GalleryItemType) {
    if (type) {
      return this.galleryService.findByType(type, true);
    }
    return this.galleryService.findAll(true);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get gallery statistics' })
  async getStats() {
    return this.galleryService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single gallery item' })
  async findOne(@Param('id') id: string) {
    return this.galleryService.findOne(id);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a new gallery item (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['image', 'video'] },
        title: { type: 'string' },
        description: { type: 'string' },
        order: { type: 'number' },
      },
      required: ['file', 'type'],
    },
  })
  async upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 100 * 1024 * 1024 }), // 100MB max
          new FileTypeValidator({ fileType: /(image|video)\/*/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: CreateGalleryItemDto,
  ) {
    return this.galleryService.uploadAndCreate(file, dto);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a gallery item (admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateGalleryItemDto) {
    return this.galleryService.update(id, dto);
  }

  @Put('reorder/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder gallery items (admin only)' })
  async reorder(@Body() dto: ReorderGalleryItemsDto) {
    await this.galleryService.reorder(dto.itemIds);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a gallery item (admin only)' })
  async remove(@Param('id') id: string) {
    await this.galleryService.remove(id);
    return { success: true };
  }
}
