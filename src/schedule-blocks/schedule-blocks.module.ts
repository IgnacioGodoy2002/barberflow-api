import { Module } from '@nestjs/common';
import { ScheduleBlocksController } from './schedule-blocks.controller';
import { ScheduleBlocksService } from './schedule-blocks.service';

@Module({
  controllers: [ScheduleBlocksController],
  providers: [ScheduleBlocksService],
})
export class ScheduleBlocksModule {}