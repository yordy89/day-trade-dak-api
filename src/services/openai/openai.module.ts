import { Module } from '@nestjs/common';
import { OpenaiController } from './openai.controller';
import { OpenAiService } from './openai.service';
import { UsersModule } from 'src/users/users.module';
import { AxiosModule } from 'src/axios/axios.module';

@Module({
  imports: [UsersModule, AxiosModule],
  controllers: [OpenaiController],
  providers: [OpenAiService],
  exports: [OpenAiService],
})
export class OpenaiModule {}
