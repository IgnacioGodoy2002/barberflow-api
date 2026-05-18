import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { CreateBarberAdminDto } from './dto/create-barber-admin.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AssignServicesDto } from './dto/assign-services.dto';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';


@Injectable()
export class BarbersService {
  constructor(private readonly prisma: PrismaService) {}

    async createFromAdmin(dto: CreateBarberAdminDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Ya existe un usuario con ese email');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          password: passwordHash,
          role: 'BARBER',
        },
      });

      const barber = await tx.barber.create({
        data: {
          userId: user.id,
          displayName: dto.displayName,
          bio: dto.bio,
        },
        include: this.defaultInclude(),
      });

      return barber;
    });
  }

  async create(dto: CreateBarberDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (user.role !== 'BARBER') {
      throw new BadRequestException(
        'El usuario debe tener rol BARBER para crear un perfil de barbero',
      );
    }

    const existingBarber = await this.prisma.barber.findUnique({
      where: { userId: dto.userId },
    });

    if (existingBarber) {
      throw new BadRequestException('Este usuario ya tiene perfil de barbero');
    }

    if (dto.serviceIds && dto.serviceIds.length > 0) {
      await this.validateServices(dto.serviceIds);
    }

    return this.prisma.barber.create({
      data: {
        userId: dto.userId,
        displayName: dto.displayName,
        bio: dto.bio,
        services:
          dto.serviceIds && dto.serviceIds.length > 0
            ? {
                create: dto.serviceIds.map((serviceId) => ({
                  serviceId,
                })),
              }
            : undefined,
      },
      include: this.defaultInclude(),
    });
  }

  findAll() {
    return this.prisma.barber.findMany({
      where: {
        isActive: true,
      },
      include: this.defaultInclude(),
      orderBy: {
        displayName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id },
      include: this.defaultInclude(),
    });

    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado');
    }

    return barber;
  }

  async update(id: string, dto: UpdateBarberDto) {
    await this.findOne(id);

    return this.prisma.barber.update({
      where: { id },
      data: {
        displayName: dto.displayName,
        bio: dto.bio,
      },
      include: this.defaultInclude(),
    });
  }

  async assignServices(id: string, dto: AssignServicesDto) {
    await this.findOne(id);
    await this.validateServices(dto.serviceIds);

    await this.prisma.barberService.deleteMany({
      where: {
        barberId: id,
      },
    });

    if (dto.serviceIds.length > 0) {
      await this.prisma.barberService.createMany({
        data: dto.serviceIds.map((serviceId) => ({
          barberId: id,
          serviceId,
        })),
      });
    }

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.barber.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: this.defaultInclude(),
    });
  }

  private async validateServices(serviceIds: string[]) {
    const services = await this.prisma.service.findMany({
      where: {
        id: {
          in: serviceIds,
        },
        isActive: true,
      },
    });

    if (services.length !== serviceIds.length) {
      throw new BadRequestException(
        'Uno o más servicios no existen o están inactivos',
      );
    }
  }

  private defaultInclude() {
    return {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
        },
      },
      services: {
        include: {
          service: true,
        },
      },
    };
  }
}