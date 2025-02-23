import { Body, Controller, Post, Req } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { RequestWithUser } from 'src/auth/auth.interfaces';

@Controller('openai')
export class OpenaiController {
  constructor(private readonly openaiService: OpenAiService) {}

  @Post('determine-phase')
  determinePhase(@Body() description, @Req() req: RequestWithUser) {
    const userId = req.user?._id;
    return this.openaiService.determinePhase(description.response, userId);
  }
}
