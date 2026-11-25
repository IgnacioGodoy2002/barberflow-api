import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addMinutes } from '../common/timezone';
import { webUrl } from '../common/urls';
import { reminderEmail } from '../notifications/email-templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

/** Ventana en la que se manda el recordatorio: entre 20 y 26 horas antes del turno. */
const WINDOW_FROM_MINUTES = 20 * 60;
const WINDOW_TO_MINUTES = 26 * 60;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  /** Manda el recordatorio de "tu turno es mañana" una sola vez por turno. */
  async sendDueReminders(now = new Date()) {
    const due = await this.prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        reminderSentAt: null,
        startAt: {
          gte: addMinutes(now, WINDOW_FROM_MINUTES),
          lte: addMinutes(now, WINDOW_TO_MINUTES),
        },
        // Si reservó hace un rato, no tiene sentido recordarle.
        createdAt: { lte: addMinutes(now, -60) },
      },
      include: {
        client: true,
        service: true,
        barber: true,
      },
    });

    let sent = 0;

    for (const appointment of due) {
      const email = reminderEmail({
        clientName: appointment.client.fullName,
        serviceName: appointment.service.name,
        barberName: appointment.barber.displayName,
        startAt: appointment.startAt,
        webUrl: webUrl(this.config),
      });

      const delivered = await this.notifications.sendEmail({
        to: appointment.client.email,
        ...email,
      });
      if (delivered) sent += 1;

      // Se marca igual (aunque no haya email configurado) para no reintentar para siempre.
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: now },
      });
    }

    if (due.length > 0) {
      this.logger.log(
        `Recordatorios: ${due.length} turnos procesados, ${sent} emails enviados`,
      );
    }

    return { processed: due.length, sent };
  }
}
