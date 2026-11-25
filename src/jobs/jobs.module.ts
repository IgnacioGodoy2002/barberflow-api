import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { RemindersService } from './reminders.service';

@Module({
  imports: [PaymentsModule],
  controllers: [JobsController],
  providers: [JobsService, RemindersService],
  exports: [RemindersService],
})
export class JobsModule {}
