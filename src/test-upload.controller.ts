import { Controller, Get, Post, Body } from '@nestjs/common';

@Controller('test-upload')
export class TestUploadController {
  @Get()
  test() {
    return { message: 'Test upload endpoint is working' };
  }

  @Post('initiate')
  initiateUpload(@Body() body: any) {
    return { 
      message: 'Upload initiated',
      fileName: body.fileName,
      fileSize: body.fileSize,
      contentType: body.contentType 
    };
  }
}