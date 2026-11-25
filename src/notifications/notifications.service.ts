import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

/** Direcciones que no son reales: clientes cargados a mano, cuenta demo, etc. */
const NON_DELIVERABLE = [
  /@barberflow\.app$/i,
  /@example\.(com|org)$/i,
  /\.local$/i,
];

/**
 * Envío de emails con Resend (https://resend.com, plan gratis).
 * Si no hay RESEND_API_KEY configurada, no envía nada: solo lo deja en el log.
 * Así el proyecto funciona igual en local y en los tests.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled() {
    return Boolean(this.config.get<string>('RESEND_API_KEY'));
  }

  async sendEmail(message: EmailMessage): Promise<boolean> {
    if (
      !message.to ||
      NON_DELIVERABLE.some((pattern) => pattern.test(message.to))
    ) {
      this.logger.debug(`Email omitido (dirección no real): ${message.to}`);
      return false;
    }

    const apiKey = this.config.get<string>('RESEND_API_KEY');

    if (!apiKey) {
      this.logger.log(
        `[email sin enviar: falta RESEND_API_KEY] ${message.subject} → ${message.to}`,
      );
      return false;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:
            this.config.get<string>('EMAIL_FROM') ??
            'BarberFlow <onboarding@resend.dev>',
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Resend respondió ${response.status}: ${await response.text()}`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar el email: ${(error as Error).message}`,
      );
      return false;
    }
  }
}
