import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

type AuthUser = {
  id: string;
  email: string;
  role: string;
  fullName: string;
};

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto, user: AuthUser) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const barber = await this.prisma.barber.findUnique({
      where: { id: dto.barberId },
      include: {
        services: true,
      },
    });

    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado');
    }

    const barberCanDoService = barber.services.some(
      (barberService) => barberService.serviceId === dto.serviceId,
    );

    if (!barberCanDoService) {
      throw new BadRequestException(
        'El barbero no tiene asignado este servicio',
      );
    }

    const startAt = new Date(dto.startAt);

    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    if (startAt.getTime() <= new Date().getTime()) {
      throw new BadRequestException(
        'No se puede reservar un turno en el pasado',
      );
    }

    const endAt = this.addMinutes(startAt, service.durationMinutes);
    const blockedEndAt = this.addMinutes(
      startAt,
      service.durationMinutes + service.bufferMinutes,
    );

    await this.validateInsideWorkingHours(dto.barberId, startAt, endAt);

    await this.validateNoScheduleBlockConflict(
      dto.barberId,
      startAt,
      blockedEndAt,
    );

    await this.validateNoAppointmentConflict({
      barberId: dto.barberId,
      startAt,
      blockedEndAt,
    });

    return this.prisma.appointment.create({
      data: {
        clientId: user.id,
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        startAt,
        endAt,
        status: 'CONFIRMED',
        notes: dto.notes,
      },
      include: this.defaultInclude(),
    });
  }

  findMine(user: AuthUser) {
    return this.prisma.appointment.findMany({
      where: {
        clientId: user.id,
      },
      include: this.defaultInclude(),
      orderBy: {
        startAt: 'asc',
      },
    });
  }

  findAll() {
    return this.prisma.appointment.findMany({
      include: this.defaultInclude(),
      orderBy: {
        startAt: 'asc',
      },
    });
  }

  async update(id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        barber: {
          include: {
            services: true,
          },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('No se puede editar un turno cancelado');
    }

    const nextBarberId = dto.barberId ?? appointment.barberId;
    const nextServiceId = dto.serviceId ?? appointment.serviceId;
    const nextStartAt = dto.startAt
      ? new Date(dto.startAt)
      : appointment.startAt;

    if (Number.isNaN(nextStartAt.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    if (nextStartAt.getTime() <= new Date().getTime()) {
      throw new BadRequestException(
        'No se puede mover un turno a una fecha pasada',
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: nextServiceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const barber = await this.prisma.barber.findUnique({
      where: { id: nextBarberId },
      include: {
        services: true,
      },
    });

    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado');
    }

    const barberCanDoService = barber.services.some(
      (barberService) => barberService.serviceId === nextServiceId,
    );

    if (!barberCanDoService) {
      throw new BadRequestException(
        'El barbero no tiene asignado este servicio',
      );
    }

    const nextEndAt = this.addMinutes(nextStartAt, service.durationMinutes);
    const blockedEndAt = this.addMinutes(
      nextStartAt,
      service.durationMinutes + service.bufferMinutes,
    );

    await this.validateInsideWorkingHours(nextBarberId, nextStartAt, nextEndAt);

    await this.validateNoScheduleBlockConflict(
      nextBarberId,
      nextStartAt,
      blockedEndAt,
    );

    await this.validateNoAppointmentConflict({
      barberId: nextBarberId,
      startAt: nextStartAt,
      blockedEndAt,
      appointmentIdToIgnore: id,
    });

    return this.prisma.appointment.update({
      where: { id },
      data: {
        barberId: nextBarberId,
        serviceId: nextServiceId,
        startAt: nextStartAt,
        endAt: nextEndAt,
        notes: dto.notes ?? appointment.notes,
      },
      include: this.defaultInclude(),
    });
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede cambiar el estado de un turno cancelado',
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: this.defaultInclude(),
    });
  }

  async cancel(id: string, dto: CancelAppointmentDto, user: AuthUser) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Turno no encontrado');
    }

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('El turno ya está cancelado');
    }

    const isOwner = appointment.clientId === user.id;
    const canCancel = user.role === 'ADMIN' || user.role === 'BARBER' || isOwner;

    if (!canCancel) {
      throw new ForbiddenException('No tenés permisos para cancelar este turno');
    }

    return this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason ?? 'Cancelado por el usuario',
      },
      include: this.defaultInclude(),
    });
  }

  private async validateInsideWorkingHours(
    barberId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const dayOfWeek = startAt.getDay();
    const startTime = this.formatTime(startAt);
    const endTime = this.formatTime(endAt);

    const workingHours = await this.prisma.workingHour.findMany({
      where: {
        barberId,
        dayOfWeek,
        isActive: true,
      },
    });

    const isInside = workingHours.some((hour) => {
      return startTime >= hour.startTime && endTime <= hour.endTime;
    });

    if (!isInside) {
      throw new BadRequestException(
        'El turno está fuera del horario laboral del barbero',
      );
    }
  }

  private async validateNoScheduleBlockConflict(
    barberId: string,
    startAt: Date,
    blockedEndAt: Date,
  ) {
    const blocks = await this.prisma.scheduleBlock.findMany({
      where: {
        barberId,
        isActive: true,
        startAt: {
          lt: blockedEndAt,
        },
        endAt: {
          gt: startAt,
        },
      },
    });

    if (blocks.length > 0) {
      throw new BadRequestException(
        'El horario seleccionado está bloqueado en la agenda del barbero',
      );
    }
  }

  private async validateNoAppointmentConflict(params: {
    barberId: string;
    startAt: Date;
    blockedEndAt: Date;
    appointmentIdToIgnore?: string;
  }) {
    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        ...(params.appointmentIdToIgnore
          ? {
              id: {
                not: params.appointmentIdToIgnore,
              },
            }
          : {}),
        barberId: params.barberId,
        status: {
          notIn: ['CANCELLED', 'NO_SHOW'],
        },
        startAt: {
          lt: params.blockedEndAt,
        },
        endAt: {
          gt: params.startAt,
        },
      },
      include: {
        service: true,
      },
    });

    const hasConflict = existingAppointments.some((existingAppointment) => {
      const appointmentBlockedEnd = this.addMinutes(
        existingAppointment.endAt,
        existingAppointment.service.bufferMinutes,
      );

      return (
        params.startAt < appointmentBlockedEnd &&
        params.blockedEndAt > existingAppointment.startAt
      );
    });

    if (hasConflict) {
      throw new BadRequestException(
        'El horario seleccionado ya no está disponible',
      );
    }
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

  private defaultInclude() {
    return {
      client: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      barber: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
            },
          },
        },
      },
      service: true,
    };
  }
}