import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';

@Controller('contact-messages')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createContactMessageDto: CreateContactMessageDto) {
    const message = await this.contactService.create(createContactMessageDto);
    
    return {
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      data: {
        id: (message as any)._id,
        createdAt: (message as any).createdAt,
      },
    };
  }
}