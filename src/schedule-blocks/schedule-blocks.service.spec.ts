import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleBlocksService } from './schedule-blocks.service';

describe('ScheduleBlocksService', () => {
  let service: ScheduleBlocksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScheduleBlocksService],
    }).compile();

    service = module.get<ScheduleBlocksService>(ScheduleBlocksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
