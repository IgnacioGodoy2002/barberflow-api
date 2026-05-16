import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';

type AuthUser = {
  id: string;
  email: string;
  role: string;
  fullName: string;
};

@Injectable()
export class ScheduleBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateScheduleBlockDto, user: AuthUser) {
    const barber = await this.validateBarber(dto.barberId);
    this.validateCanManageBarber(barber.userId, user);

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Fechas inválidas');
    }

    if (startAt >= endAt) {
      throw new BadRequestException(
        'La fecha de inicio debe ser menor a la fecha de fin',
      );
    }

    await this.validateNoBlockOverlap(dto.barberId, startAt, endAt);
    await this.validateNoActiveAppointmentOverlap(dto.barberId, startAt, endAt);

    return this.prisma.scheduleBlock.create({
      data: {
        barberId: dto.barberId,
        startAt,
        endAt,
        type: dto.type ?? 'OTHER',
        reason: dto.reason,
        isActive: dto.isActive ?? true,
      },
      include: {
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
      },
    });
  }

  async findByBarber(barberId: string, user: AuthUser) {
    const barber = await this.validateBarber(barberId);
    this.validateCanManageBarber(barber.userId, user);

    return this.prisma.scheduleBlock.findMany({
      where: {
        barberId,
        isActive: true,
      },
      orderBy: {
        startAt: 'asc',
      },
    });
  }

  async remove(id: string, user: AuthUser) {
    const block = await this.prisma.scheduleBlock.findUnique({
      where: { id },
      include: {
        barber: true,
      },
    });

    if (!block || !block.isActive) {
      throw new NotFoundException('Bloqueo de agenda no encontrado');
    }

    this.validateCanManageBarber(block.barber.userId, user);

    return this.prisma.scheduleBlock.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  private async validateBarber(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });

    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado');
    }

    return barber;
  }

  private validateCanManageBarber(barberUserId: string, user: AuthUser) {
    if (user.role === 'ADMIN') {
      return;
    }

    if (user.role === 'BARBER' && barberUserId === user.id) {
      return;
    }

    throw new ForbiddenException(
      'No tenés permisos para administrar esta agenda',
    );
  }

  private async validateNoBlockOverlap(
    barberId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const existingBlocks = await this.prisma.scheduleBlock.findMany({
      where: {
        barberId,
        isActive: true,
        startAt: {
          lt: endAt,
        },
        endAt: {
          gt: startAt,
        },
      },
    });

    if (existingBlocks.length > 0) {
      throw new BadRequestException(
        'El bloqueo se superpone con otro bloqueo existente',
      );
    }
  }

  private async validateNoActiveAppointmentOverlap(
    barberId: string,
    startAt: Date,
    endAt: Date,
  ) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        status: {
          notIn: ['CANCELLED', 'NO_SHOW'],
        },
        startAt: {
          lt: endAt,
        },
        endAt: {
          gt: startAt,
        },
      },
    });

    if (appointments.length > 0) {
      throw new BadRequestException(
        'No se puede bloquear este horario porque ya existen turnos activos en ese rango',
      );
    }
  }
}