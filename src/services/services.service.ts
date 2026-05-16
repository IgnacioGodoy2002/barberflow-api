import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes ?? 10,
        price: dto.price,
      },
    });
  }

  findAll() {
    return this.prisma.service.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Servicio no encontrado');
    }

    return service;
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOne(id);

    return this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        durationMinutes: dto.durationMinutes,
        bufferMinutes: dto.bufferMinutes,
        price: dto.price,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.service.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}