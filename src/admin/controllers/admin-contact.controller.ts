import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../guards/jwt-auth-guard';
import { RolesGuard } from '../../guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../constants';
import { ContactService } from '../../contact/contact.service';
import { UpdateContactMessageDto } from '../../contact/dto/update-contact-message.dto';
import { ContactMessageStatus } from '../../contact/contact-message.schema';

@Controller('admin/contact-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  async findAll(
    @Query('status') status?: ContactMessageStatus,
    @Query('inquiryType') inquiryType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const query = {
      status,
      inquiryType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };

    return this.contactService.findAll(query);
  }

  @Get('unread-count')
  async getUnreadCount() {
    const count = await this.contactService.getUnreadCount();
    return { count };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.contactService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateContactMessageDto: UpdateContactMessageDto,
    @Request() req,
  ) {
    return this.contactService.update(id, updateContactMessageDto, req.user?.id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.contactService.remove(id);
    return { message: 'Contact message deleted successfully' };
  }
}