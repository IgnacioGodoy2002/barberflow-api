import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkingHourDto } from './dto/create-working-hour.dto';
import { UpdateWorkingHourDto } from './dto/update-working-hour.dto';

@Injectable()
export class WorkingHoursService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkingHourDto) {
    await this.validateBarber(dto.barberId);
    this.validateTimeRange(dto.startTime, dto.endTime);

    await this.validateNoOverlap({
      barberId: dto.barberId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    return this.prisma.workingHour.create({
      data: {
        barberId: dto.barberId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
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

  async findByBarber(barberId: string) {
    await this.validateBarber(barberId);

    return this.prisma.workingHour.findMany({
      where: {
        barberId,
        isActive: true,
      },
      orderBy: [
        {
          dayOfWeek: 'asc',
        },
        {
          startTime: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const workingHour = await this.prisma.workingHour.findUnique({
      where: { id },
    });

    if (!workingHour || !workingHour.isActive) {
      throw new NotFoundException('Horario de trabajo no encontrado');
    }

    return workingHour;
  }

  async update(id: string, dto: UpdateWorkingHourDto) {
    const current = await this.findOne(id);

    const barberId = dto.barberId ?? current.barberId;
    const dayOfWeek = dto.dayOfWeek ?? current.dayOfWeek;
    const startTime = dto.startTime ?? current.startTime;
    const endTime = dto.endTime ?? current.endTime;

    await this.validateBarber(barberId);
    this.validateTimeRange(startTime, endTime);

    await this.validateNoOverlap({
      barberId,
      dayOfWeek,
      startTime,
      endTime,
      ignoreId: id,
    });

    return this.prisma.workingHour.update({
      where: { id },
      data: {
        barberId,
        dayOfWeek,
        startTime,
        endTime,
        isActive: dto.isActive ?? current.isActive,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.workingHour.update({
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

  private validateTimeRange(startTime: string, endTime: string) {
    if (startTime >= endTime) {
      throw new BadRequestException(
        'La hora de inicio debe ser menor a la hora de fin',
      );
    }
  }

  private async validateNoOverlap(params: {
    barberId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    ignoreId?: string;
  }) {
    const existingHours = await this.prisma.workingHour.findMany({
      where: {
        barberId: params.barberId,
        dayOfWeek: params.dayOfWeek,
        isActive: true,
        id: params.ignoreId
          ? {
              not: params.ignoreId,
            }
          : undefined,
      },
    });

    const hasOverlap = existingHours.some((hour) => {
      return params.startTime < hour.endTime && params.endTime > hour.startTime;
    });

    if (hasOverlap) {
      throw new BadRequestException(
        'El horario se superpone con otro horario existente del barbero',
      );
    }
  }
}