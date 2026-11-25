import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { AvailabilityModule } from './availability/availability.module';
import { BarbersModule } from './barbers/barbers.module';
import { DemoInterceptor } from './demo/demo.interceptor';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleBlocksModule } from './schedule-blocks/schedule-blocks.module';
import { ServicesModule } from './services/services.module';
import { StatsModule } from './stats/stats.module';
import { UsersModule } from './users/users.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { WorkingHoursModule } from './working-hours/working-hours.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NotificationsModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ServicesModule,
    BarbersModule,
    WorkingHoursModule,
    AvailabilityModule,
    AppointmentsModule,
    ScheduleBlocksModule,
    WaitlistModule,
    PaymentsModule,
    JobsModule,
    StatsModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: DemoInterceptor }],
})
export class AppModule {}
