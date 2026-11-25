import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

@Module({
  imports: [PaymentsModule, WaitlistModule],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
})
export class AppointmentsModule {}
