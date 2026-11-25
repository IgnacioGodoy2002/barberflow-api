import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../common/auth-user';
import { toLocalDateString } from '../common/timezone';
import { webUrl } from '../common/urls';
import { slotFreedEmail } from '../notifications/email-templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';

/** A cuántas personas de la lista se avisa cuando se libera un turno. */
const NOTIFY_BATCH = 3;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async join(dto: CreateWaitlistEntryDto, user: AuthUser) {
    if (dto.date < toLocalDateString(new Date())) {
      throw new BadRequestException(
        'No podés anotarte para un día que ya pasó',
      );
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });
    if (!service || !service.isActive)
      throw new NotFoundException('Servicio no encontrado');

    if (dto.barberId) {
      const barber = await this.prisma.barber.findUnique({
        where: { id: dto.barberId },
      });
      if (!barber || !barber.isActive)
        throw new NotFoundException('Barbero no encontrado');
    }

    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        clientId: user.id,
        serviceId: dto.serviceId,
        date: dto.date,
        barberId: dto.barberId ?? null,
        notifiedAt: null,
      },
    });
    if (existing) return existing;

    return this.prisma.waitlistEntry.create({
      data: {
        clientId: user.id,
        serviceId: dto.serviceId,
        barberId: dto.barberId ?? null,
        date: dto.date,
      },
      include: { service: true, barber: true },
    });
  }

  findMine(user: AuthUser) {
    return this.prisma.waitlistEntry.findMany({
      where: {
        clientId: user.id,
        date: { gte: toLocalDateString(new Date()) },
      },
      include: { service: true, barber: true },
      orderBy: { date: 'asc' },
    });
  }

  findAll() {
    return this.prisma.waitlistEntry.findMany({
      where: { date: { gte: toLocalDateString(new Date()) } },
      include: {
        service: true,
        barber: true,
        client: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async leave(id: string, user: AuthUser) {
    const entry = await this.prisma.waitlistEntry.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('No estás anotado en esa lista');
    if (entry.clientId !== user.id && user.role !== 'ADMIN') {
      throw new ForbiddenException('No podés borrar esta inscripción');
    }
    await this.prisma.waitlistEntry.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Se liberó un horario (cancelación, reprogramación o seña vencida):
   * avisa por email a los primeros de la lista de espera de ese día y servicio.
   */
  async notifyFreedSlot(appointment: {
    barberId: string;
    serviceId: string;
    startAt: Date;
  }) {
    if (appointment.startAt.getTime() <= Date.now()) return 0;

    const date = toLocalDateString(appointment.startAt);
    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        date,
        serviceId: appointment.serviceId,
        notifiedAt: null,
        OR: [{ barberId: null }, { barberId: appointment.barberId }],
      },
      include: { client: true, service: true },
      orderBy: { createdAt: 'asc' },
      take: NOTIFY_BATCH,
    });

    for (const entry of entries) {
      const email = slotFreedEmail({
        clientName: entry.client.fullName,
        serviceName: entry.service.name,
        date,
        webUrl: webUrl(this.config),
      });
      await this.notifications.sendEmail({ to: entry.client.email, ...email });
      await this.prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: { notifiedAt: new Date() },
      });
    }

    if (entries.length > 0) {
      this.logger.log(
        `Turno liberado el ${date}: avisamos a ${entries.length} de la lista de espera`,
      );
    }

    return entries.length;
  }
}
