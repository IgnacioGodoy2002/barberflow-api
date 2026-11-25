import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthUser } from '../common/auth-user';
import { addMinutes } from '../common/timezone';
import { apiUrl, webUrl } from '../common/urls';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { isValidMercadoPagoSignature } from './mercado-pago.signature';

const MP_API = process.env.MP_API_BASE ?? 'https://api.mercadopago.com';

type AppointmentForCheckout = {
  id: string;
  serviceId: string;
  service: { name: string; price: unknown };
  client: { email: string };
};

type MercadoPagoPayment = {
  id: number | string;
  /** approved, pending, in_process, rejected, cancelled, refunded… */
  status: string;
  external_reference?: string;
};

/**
 * Seña con Mercado Pago (Checkout Pro).
 *
 * Flujo:
 * 1. El cliente reserva → el turno queda PENDING y se crea una "preferencia" de pago.
 * 2. El cliente paga en Mercado Pago y vuelve a la web.
 * 3. MP avisa por webhook → consultamos el pago a MP (no confiamos en el body)
 *    y, si está aprobado, el turno pasa a CONFIRMED.
 * 4. Si no paga a tiempo, un job vence la seña y libera el horario.
 *
 * Sin MP_ACCESS_TOKEN el sistema funciona como antes: el turno se confirma directo.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly waitlist: WaitlistService,
  ) {}

  isEnabled() {
    return Boolean(this.config.get<string>('MP_ACCESS_TOKEN'));
  }

  depositPercent() {
    const value = Number(this.config.get<string>('DEPOSIT_PERCENT') ?? 30);
    return Number.isFinite(value) && value > 0 && value <= 100 ? value : 30;
  }

  timeoutMinutes() {
    const value = Number(
      this.config.get<string>('PAYMENT_TIMEOUT_MINUTES') ?? 20,
    );
    return Number.isFinite(value) && value >= 5 ? value : 20;
  }

  /** Monto de la seña, redondeado a $100 para que quede prolijo. */
  depositFor(price: unknown) {
    const amount = (Number(price) * this.depositPercent()) / 100;
    return Math.max(100, Math.round(amount / 100) * 100);
  }

  getPublicConfig() {
    return {
      enabled: this.isEnabled(),
      depositPercent: this.depositPercent(),
      timeoutMinutes: this.timeoutMinutes(),
    };
  }

  async createCheckout(appointment: AppointmentForCheckout) {
    const amount = this.depositFor(appointment.service.price);
    const expiresAt = addMinutes(new Date(), this.timeoutMinutes());
    const web = webUrl(this.config);

    const response = await fetch(`${MP_API}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('MP_ACCESS_TOKEN')}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': appointment.id,
      },
      body: JSON.stringify({
        items: [
          {
            id: appointment.serviceId,
            title: `Seña turno: ${appointment.service.name}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'ARS',
          },
        ],
        payer: { email: appointment.client.email },
        external_reference: appointment.id,
        notification_url: `${apiUrl(this.config)}/v1/payments/webhook`,
        back_urls: {
          success: `${web}?pago=aprobado#reservar`,
          pending: `${web}?pago=pendiente#reservar`,
          failure: `${web}?pago=error#reservar`,
        },
        auto_return: 'approved',
        expires: true,
        expiration_date_to: expiresAt.toISOString(),
        statement_descriptor: 'NACHO BARBER',
      }),
    });

    if (!response.ok) {
      this.logger.error(
        `Mercado Pago respondió ${response.status}: ${await response.text()}`,
      );
      throw new BadGatewayException(
        'No pudimos iniciar el pago de la seña. Probá de nuevo.',
      );
    }

    const preference = (await response.json()) as {
      id: string;
      init_point: string;
    };

    return this.prisma.payment.create({
      data: {
        appointmentId: appointment.id,
        amount,
        preferenceId: preference.id,
        checkoutUrl: preference.init_point,
        expiresAt,
      },
    });
  }

  async findForAppointment(appointmentId: string, user: AuthUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { appointmentId },
      include: { appointment: { select: { clientId: true, status: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Este turno no tiene seña');
    }

    const isStaff = user.role === 'ADMIN' || user.role === 'BARBER';
    if (!isStaff && payment.appointment.clientId !== user.id) {
      throw new ForbiddenException('No podés ver este pago');
    }

    return payment;
  }

  /** Procesa el aviso de Mercado Pago. Devuelve qué se hizo (útil para logs y tests). */
  async handleWebhook(params: {
    type?: string;
    dataId?: string;
    signatureHeader?: string;
    requestId?: string;
  }) {
    if (!this.isEnabled()) return { ignored: 'pagos deshabilitados' };
    if (params.type !== 'payment' || !params.dataId)
      return { ignored: 'no es un pago' };

    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (
      secret &&
      !isValidMercadoPagoSignature({
        secret,
        signatureHeader: params.signatureHeader,
        requestId: params.requestId,
        dataId: params.dataId,
      })
    ) {
      throw new UnauthorizedException('Firma de Mercado Pago inválida');
    }

    // Nunca confiamos en el body: le preguntamos a MP el estado real del pago.
    const response = await fetch(
      `${MP_API}/v1/payments/${encodeURIComponent(params.dataId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.get<string>('MP_ACCESS_TOKEN')}`,
        },
      },
    );

    if (!response.ok) {
      this.logger.warn(
        `No se pudo consultar el pago ${params.dataId}: ${response.status}`,
      );
      throw new BadGatewayException('No se pudo consultar el pago');
    }

    const mpPayment = (await response.json()) as MercadoPagoPayment;
    return this.applyPaymentStatus(mpPayment);
  }

  async applyPaymentStatus(mpPayment: MercadoPagoPayment) {
    const appointmentId = mpPayment.external_reference;
    if (!appointmentId) return { ignored: 'pago sin referencia' };

    const payment = await this.prisma.payment.findUnique({
      where: { appointmentId },
      include: { appointment: true },
    });
    if (!payment) return { ignored: 'pago desconocido' };

    if (mpPayment.status === 'approved') {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', providerPaymentId: String(mpPayment.id) },
        }),
        ...(payment.appointment.status === 'PENDING'
          ? [
              this.prisma.appointment.update({
                where: { id: appointmentId },
                data: { status: 'CONFIRMED' },
              }),
            ]
          : []),
      ]);

      if (payment.appointment.status === 'CANCELLED') {
        // Pagó después de que venció la seña: hay que devolverle la plata.
        this.logger.warn(
          `Seña acreditada en un turno ya cancelado (${appointmentId}): revisar devolución`,
        );
        return { approved: true, needsRefund: true };
      }

      return { approved: true };
    }

    if (mpPayment.status === 'rejected' || mpPayment.status === 'cancelled') {
      // El turno sigue PENDING: el cliente puede reintentar hasta que venza.
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REJECTED', providerPaymentId: String(mpPayment.id) },
      });
      return { rejected: true };
    }

    return { pending: true };
  }

  /** Cancela los turnos cuya seña no se pagó a tiempo y libera el horario. */
  async expireUnpaid(now = new Date()) {
    const expired = await this.prisma.payment.findMany({
      where: {
        status: { in: ['PENDING', 'REJECTED'] },
        expiresAt: { lt: now },
        appointment: { status: 'PENDING' },
      },
      include: { appointment: true },
    });

    for (const payment of expired) {
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'EXPIRED' },
        }),
        this.prisma.appointment.update({
          where: { id: payment.appointmentId },
          data: {
            status: 'CANCELLED',
            cancelReason: 'Seña no abonada a tiempo',
          },
        }),
      ]);

      await this.waitlist.notifyFreedSlot(payment.appointment);
    }

    return expired.length;
  }
}
