import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleBlocksController } from './schedule-blocks.controller';

describe('ScheduleBlocksController', () => {
  let controller: ScheduleBlocksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ScheduleBlocksController],
    }).compile();

    controller = module.get<ScheduleBlocksController>(ScheduleBlocksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
