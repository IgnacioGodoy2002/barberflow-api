import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(query: AvailabilityQueryDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: query.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const barber = await this.prisma.barber.findUnique({
      where: { id: query.barberId },
      include: {
        services: true,
      },
    });

    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado');
    }

    const barberCanDoService = barber.services.some(
      (barberService) => barberService.serviceId === query.serviceId,
    );

    if (!barberCanDoService) {
      throw new BadRequestException(
        'El barbero no tiene asignado este servicio',
      );
    }

    const requestedDate = this.parseDate(query.date);
    const dayOfWeek = requestedDate.getDay();

    const startOfDay = new Date(requestedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(requestedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const workingHours = await this.prisma.workingHour.findMany({
      where: {
        barberId: query.barberId,
        dayOfWeek,
        isActive: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const appointments = await this.prisma.appointment.findMany({
      where: {
        barberId: query.barberId,
        startAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        service: true,
      },
    });

    const activeAppointments = appointments.filter(
      (appointment) =>
        appointment.status !== 'CANCELLED' &&
        appointment.status !== 'NO_SHOW',
    );

    const slots: {
  startAt: Date;
  endAt: Date;
  label: string;
}[] = [];

    for (const workingHour of workingHours) {
      let cursor = this.buildDateTime(query.date, workingHour.startTime);
      const workingEnd = this.buildDateTime(query.date, workingHour.endTime);

      while (
        this.addMinutes(cursor, service.durationMinutes).getTime() <=
        workingEnd.getTime()
      ) {
        const slotStart = new Date(cursor);
        const slotEnd = this.addMinutes(slotStart, service.durationMinutes);
        const slotBlockedEnd = this.addMinutes(
          slotStart,
          service.durationMinutes + service.bufferMinutes,
        );

        const hasConflict = activeAppointments.some((appointment) => {
          const appointmentStart = appointment.startAt;
          const appointmentBlockedEnd = this.addMinutes(
            appointment.endAt,
            appointment.service.bufferMinutes,
          );

          return (
            slotStart < appointmentBlockedEnd &&
            slotBlockedEnd > appointmentStart
          );
        });

        const isPastSlot = slotStart.getTime() <= new Date().getTime();

        if (!hasConflict && !isPastSlot) {
          slots.push({
            startAt: slotStart,
            endAt: slotEnd,
            label: this.formatTime(slotStart),
          });
        }

        cursor = this.addMinutes(
          cursor,
          service.durationMinutes + service.bufferMinutes,
        );
      }
    }

    return {
      barberId: query.barberId,
      service: {
        id: service.id,
        name: service.name,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        price: service.price,
      },
      date: query.date,
      totalSlots: slots.length,
      slots,
    };
  }

  private parseDate(date: string) {
    const parsedDate = new Date(`${date}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    return parsedDate;
  }

  private buildDateTime(date: string, time: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(`${date}T00:00:00`);

    result.setHours(hours, minutes, 0, 0);

    return result;
  }

  private addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private formatTime(date: Date) {
    return date.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}