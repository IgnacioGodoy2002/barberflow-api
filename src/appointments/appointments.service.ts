import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { AuthUser } from '../common/auth-user';
import {
  addMinutes,
  toLocalDateString,
  toLocalTimeString,
} from '../common/timezone';
import type { Prisma } from '../generated/prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAdminAppointmentDto } from './dto/create-admin-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

type Db = PrismaService | Prisma.TransactionClient;

/** Estados que ocupan el horario en la agenda. */
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED'] as const;

/** El buffer más largo posible de un servicio (para la búsqueda de solapamientos). */
const MAX_BUFFER_MINUTES = 240;

export const RESCHEDULE_MIN_HOURS = 2;
export const RESCHEDULE_MAX_TIMES = 2;

type SlotRequest = {
  barberId: string;
  serviceId: string;
  startAt: Date;
  appointmentIdToIgnore?: string;
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly waitlist: WaitlistService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reservas
  // ---------------------------------------------------------------------------

  /**
   * Reserva del cliente. Si la seña está habilitada, el turno queda PENDING
   * hasta que Mercado Pago confirme el pago; si no, queda CONFIRMED.
   */
  async create(dto: CreateAppointmentDto, user: AuthUser) {
    const requiresDeposit = this.payments.isEnabled();

    const appointment = await this.withBarberLock(dto.barberId, async (tx) => {
      const { startAt, endAt } = await this.validateSlot(tx, {
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        startAt: this.parseStart(dto.startAt),
      });

      return tx.appointment.create({
        data: {
          clientId: user.id,
          barberId: dto.barberId,
          serviceId: dto.serviceId,
          startAt,
          endAt,
          status: requiresDeposit ? 'PENDING' : 'CONFIRMED',
          notes: dto.notes,
        },
        include: this.defaultInclude(),
      });
    });

    if (!requiresDeposit) return appointment;

    try {
      const payment = await this.payments.createCheckout(appointment);
      return { ...appointment, payment };
    } catch (error) {
      // Si no se pudo crear el pago, liberamos el horario para no dejarlo trabado.
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: {
          status: 'CANCELLED',
          cancelReason: 'No se pudo iniciar el pago de la seña',
        },
      });
      throw error;
    }
  }

  /** Turno cargado por el admin (cliente que reservó por teléfono o WhatsApp). */
  async createFromAdmin(dto: CreateAdminAppointmentDto) {
    const cleanFullName = dto.clientFullName.trim();
    const cleanEmail = dto.clientEmail.trim().toLowerCase();
    const cleanPhone = dto.clientPhone?.trim() || null;

    if (!cleanFullName) {
      throw new BadRequestException('El nombre del cliente es obligatorio');
    }

    return this.withBarberLock(dto.barberId, async (tx) => {
      const { startAt, endAt } = await this.validateSlot(tx, {
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        startAt: this.parseStart(dto.startAt),
      });

      const existingClient = await tx.user.findUnique({
        where: { email: cleanEmail },
      });

      const client = existingClient
        ? await tx.user.update({
            where: { id: existingClient.id },
            data: {
              fullName: cleanFullName,
              phone: cleanPhone ?? existingClient.phone,
            },
          })
        : await tx.user.create({
            data: {
              fullName: cleanFullName,
              email: cleanEmail,
              phone: cleanPhone,
              password: `manual-client-${randomUUID()}`,
              role: 'CLIENT',
              isActive: true,
            },
          });

      return tx.appointment.create({
        data: {
          clientId: client.id,
          barberId: dto.barberId,
          serviceId: dto.serviceId,
          startAt,
          endAt,
          status: 'CONFIRMED',
          notes: dto.notes || 'Turno creado manualmente desde admin',
        },
        include: this.defaultInclude(),
      });
    });
  }

  findMine(user: AuthUser) {
    return this.prisma.appointment.findMany({
      where: { clientId: user.id },
      include: this.defaultInclude(),
      orderBy: { startAt: 'asc' },
    });
  }

  findAll() {
    return this.prisma.appointment.findMany({
      include: this.defaultInclude(),
      orderBy: { startAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // Cambios
  // ---------------------------------------------------------------------------

  /** Edición completa desde el panel admin. */
  async update(id: string, dto: UpdateAppointmentDto) {
    const appointment = await this.findOrFail(id);

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('No se puede editar un turno cancelado');
    }

    const nextBarberId = dto.barberId ?? appointment.barberId;
    const nextServiceId = dto.serviceId ?? appointment.serviceId;
    const nextStartAt = dto.startAt
      ? this.parseStart(dto.startAt, 'mover')
      : appointment.startAt;

    const updated = await this.withBarberLock(nextBarberId, async (tx) => {
      const { startAt, endAt } = await this.validateSlot(tx, {
        barberId: nextBarberId,
        serviceId: nextServiceId,
        startAt: nextStartAt,
        appointmentIdToIgnore: id,
      });

      return tx.appointment.update({
        where: { id },
        data: {
          barberId: nextBarberId,
          serviceId: nextServiceId,
          startAt,
          endAt,
          notes: dto.notes ?? appointment.notes,
        },
        include: this.defaultInclude(),
      });
    });

    if (
      updated.startAt.getTime() !== appointment.startAt.getTime() ||
      updated.barberId !== appointment.barberId
    ) {
      await this.waitlist.notifyFreedSlot(appointment);
    }

    return updated;
  }

  /**
   * El cliente reprograma su propio turno (mismo barbero y servicio).
   * Reglas: hasta 2 veces por turno y con al menos 2 horas de anticipación.
   */
  async reschedule(id: string, dto: RescheduleAppointmentDto, user: AuthUser) {
    const appointment = await this.findOrFail(id);

    const isStaff = user.role === 'ADMIN' || user.role === 'BARBER';
    if (appointment.clientId !== user.id && !isStaff) {
      throw new ForbiddenException('No podés reprogramar este turno');
    }

    if (
      appointment.status !== 'CONFIRMED' &&
      appointment.status !== 'PENDING'
    ) {
      throw new BadRequestException(
        'Solo se pueden reprogramar turnos activos',
      );
    }

    const hoursLeft = (appointment.startAt.getTime() - Date.now()) / 3_600_000;
    if (!isStaff && hoursLeft < RESCHEDULE_MIN_HOURS) {
      throw new BadRequestException(
        `Los turnos se pueden reprogramar hasta ${RESCHEDULE_MIN_HOURS} horas antes. Escribinos por WhatsApp.`,
      );
    }

    if (!isStaff && appointment.rescheduleCount >= RESCHEDULE_MAX_TIMES) {
      throw new BadRequestException(
        `Ya reprogramaste este turno ${RESCHEDULE_MAX_TIMES} veces. Escribinos por WhatsApp.`,
      );
    }

    const nextStartAt = this.parseStart(dto.startAt, 'mover');

    const updated = await this.withBarberLock(
      appointment.barberId,
      async (tx) => {
        const { startAt, endAt } = await this.validateSlot(tx, {
          barberId: appointment.barberId,
          serviceId: appointment.serviceId,
          startAt: nextStartAt,
          appointmentIdToIgnore: id,
        });

        return tx.appointment.update({
          where: { id },
          data: {
            startAt,
            endAt,
            reminderSentAt: null,
            rescheduleCount: { increment: 1 },
          },
          include: this.defaultInclude(),
        });
      },
    );

    await this.waitlist.notifyFreedSlot(appointment);
    return updated;
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    const appointment = await this.findOrFail(id);

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede cambiar el estado de un turno cancelado',
      );
    }

    return this.prisma.appointment.update({
      where: { id },
      data: { status: dto.status },
      include: this.defaultInclude(),
    });
  }

  async cancel(id: string, dto: CancelAppointmentDto, user: AuthUser) {
    const appointment = await this.findOrFail(id);

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('El turno ya está cancelado');
    }

    const isOwner = appointment.clientId === user.id;
    const canCancel =
      user.role === 'ADMIN' || user.role === 'BARBER' || isOwner;

    if (!canCancel) {
      throw new ForbiddenException(
        'No tenés permisos para cancelar este turno',
      );
    }

    const cancelled = await this.prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: dto.reason ?? 'Cancelado por el usuario',
      },
      include: this.defaultInclude(),
    });

    await this.waitlist.notifyFreedSlot(appointment);
    return cancelled;
  }

  // ---------------------------------------------------------------------------
  // Validaciones
  // ---------------------------------------------------------------------------

  /**
   * Evita la doble reserva aunque lleguen dos pedidos al mismo tiempo.
   *
   * Sin esto, dos clientes podían pasar la validación "¿está libre?" a la vez
   * y los dos guardaban el turno. Ahora cada reserva toma un lock de Postgres
   * por barbero (pg_advisory_xact_lock) dentro de una transacción: la segunda
   * espera a que termine la primera y, cuando valida, ya ve el turno ocupado.
   * El lock se libera solo al terminar la transacción.
   */
  private withBarberLock<T>(
    barberId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`barber:${barberId}`}))`;
        return work(tx);
      },
      { timeout: 15_000, maxWait: 10_000 },
    );
  }

  private parseStart(value: string, action = 'reservar') {
    const startAt = new Date(value);

    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Fecha inválida');
    }

    if (startAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        action === 'mover'
          ? 'No se puede mover un turno a una fecha pasada'
          : 'No se puede reservar un turno en el pasado',
      );
    }

    return startAt;
  }

  /** Todas las reglas de un horario. Devuelve inicio y fin si está libre. */
  private async validateSlot(db: Db, request: SlotRequest) {
    const service = await db.service.findUnique({
      where: { id: request.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const barber = await db.barber.findUnique({
      where: { id: request.barberId },
      include: { services: true },
    });

    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado');
    }

    if (!barber.services.some((item) => item.serviceId === request.serviceId)) {
      throw new BadRequestException(
        'El barbero no tiene asignado este servicio',
      );
    }

    const startAt = request.startAt;
    const endAt = addMinutes(startAt, service.durationMinutes);
    const blockedEndAt = addMinutes(
      startAt,
      service.durationMinutes + service.bufferMinutes,
    );

    await this.validateInsideWorkingHours(db, request.barberId, startAt, endAt);
    await this.validateNoScheduleBlockConflict(
      db,
      request.barberId,
      startAt,
      blockedEndAt,
    );
    await this.validateNoAppointmentConflict(db, {
      barberId: request.barberId,
      startAt,
      blockedEndAt,
      appointmentIdToIgnore: request.appointmentIdToIgnore,
    });

    return { service, startAt, endAt };
  }

  private async validateInsideWorkingHours(
    db: Db,
    barberId: string,
    startAt: Date,
    endAt: Date,
  ) {
    // Día y hora siempre en hora de Argentina, aunque el servidor esté en UTC.
    const localDate = toLocalDateString(startAt);
    const dayOfWeek = new Date(`${localDate}T12:00:00Z`).getUTCDay();
    const startTime = toLocalTimeString(startAt);
    const endTime = toLocalTimeString(endAt);
    const crossesMidnight = toLocalDateString(endAt) !== localDate;

    const workingHours = await db.workingHour.findMany({
      where: { barberId, dayOfWeek, isActive: true },
    });

    const isInside =
      !crossesMidnight &&
      workingHours.some(
        (hour) => startTime >= hour.startTime && endTime <= hour.endTime,
      );

    if (!isInside) {
      throw new BadRequestException(
        'El turno está fuera del horario laboral del barbero',
      );
    }
  }

  private async validateNoScheduleBlockConflict(
    db: Db,
    barberId: string,
    startAt: Date,
    blockedEndAt: Date,
  ) {
    const blocks = await db.scheduleBlock.count({
      where: {
        barberId,
        isActive: true,
        startAt: { lt: blockedEndAt },
        endAt: { gt: startAt },
      },
    });

    if (blocks > 0) {
      throw new BadRequestException(
        'El horario seleccionado está bloqueado en la agenda del barbero',
      );
    }
  }

  private async validateNoAppointmentConflict(
    db: Db,
    params: {
      barberId: string;
      startAt: Date;
      blockedEndAt: Date;
      appointmentIdToIgnore?: string;
    },
  ) {
    const candidates = await db.appointment.findMany({
      where: {
        ...(params.appointmentIdToIgnore
          ? { id: { not: params.appointmentIdToIgnore } }
          : {}),
        barberId: params.barberId,
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: params.blockedEndAt },
        // Antes se comparaba contra endAt sin el margen del turno existente,
        // y un turno que empezaba dentro de ese margen no se detectaba.
        endAt: { gt: addMinutes(params.startAt, -MAX_BUFFER_MINUTES) },
      },
      include: { service: true },
    });

    const hasConflict = candidates.some((existing) => {
      const existingBlockedEnd = addMinutes(
        existing.endAt,
        existing.service.bufferMinutes,
      );
      return (
        params.startAt < existingBlockedEnd &&
        params.blockedEndAt > existing.startAt
      );
    });

    if (hasConflict) {
      throw new BadRequestException(
        'El horario seleccionado ya no está disponible',
      );
    }
  }

  private async findOrFail(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new NotFoundException('Turno no encontrado');
    return appointment;
  }

  private defaultInclude() {
    return {
      client: {
        select: { id: true, fullName: true, email: true, phone: true },
      },
      barber: {
        include: {
          user: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      },
      service: true,
      payment: {
        select: {
          id: true,
          amount: true,
          status: true,
          checkoutUrl: true,
          expiresAt: true,
        },
      },
    } satisfies Prisma.AppointmentInclude;
  }
}
