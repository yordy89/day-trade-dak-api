import { Module } from '@nestjs/common';
import { MissionController } from './mission.controller';
import { MissionService } from './mission.service';
import { MongooseModule } from '@nestjs/mongoose';
import { MissionSchema } from './mission.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Mission', schema: MissionSchema }]),
  ],
  controllers: [MissionController],
  providers: [MissionService],
  exports: [MissionService],
})
export class MissionModule {}
