import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { BarbersModule } from './barbers/barbers.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ServicesModule } from './services/services.module';
import { UsersModule } from './users/users.module';
import { WorkingHoursModule } from './working-hours/working-hours.module';
import { AvailabilityModule } from './availability/availability.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ScheduleBlocksModule } from './schedule-blocks/schedule-blocks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ServicesModule,
    BarbersModule,
    WorkingHoursModule,
    AvailabilityModule,
    AppointmentsModule,
    ScheduleBlocksModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}