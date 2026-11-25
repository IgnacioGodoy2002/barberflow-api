import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Stats')
@Controller('stats')
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Números agregados (sin datos personales) para mostrar en la web y el portfolio. */
  @Get('public')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Métricas públicas: turnos gestionados, clientes, servicios',
  })
  async publicStats() {
    const [appointments, completed, clients, services, barbers, first] =
      await Promise.all([
        this.prisma.appointment.count({
          where: { status: { not: 'CANCELLED' } },
        }),
        this.prisma.appointment.count({ where: { status: 'COMPLETED' } }),
        this.prisma.user.count({
          where: { role: 'CLIENT', isDemo: false, appointments: { some: {} } },
        }),
        this.prisma.service.count({ where: { isActive: true } }),
        this.prisma.barber.count({ where: { isActive: true } }),
        this.prisma.appointment.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);

    return {
      appointmentsManaged: appointments,
      appointmentsCompleted: completed,
      clients,
      services,
      barbers,
      since: first?.createdAt ?? null,
    };
  }
}
