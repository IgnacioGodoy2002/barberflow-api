/**
 * Tests de punta a punta contra una base PostgreSQL real.
 * Necesitan DATABASE_URL apuntando a una base de PRUEBA (se vacía al empezar).
 * En CI la levanta GitHub Actions; en local: docker compose up db.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { JobsService } from '../src/jobs/jobs.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TZ_OFFSET = '-03:00';

function localDate(daysAhead: number) {
  const date = new Date(Date.now() + daysAhead * 86_400_000);
  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

describe('BarberFlow API (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let http: ReturnType<typeof request>;
  let serviceId: string;
  let barberId: string;
  const date = localDate(2);
  let counter = 0;

  const slot = (time: string) => `${date}T${time}:00${TZ_OFFSET}`;

  async function newClient(name = 'Cliente') {
    counter += 1;
    const res = await http
      .post('/v1/auth/register')
      .send({
        fullName: `${name} ${counter}`,
        email: `cliente${counter}@test.com`,
        password: 'secreto123',
      })
      .expect(201);
    return {
      token: res.body.accessToken as string,
      id: res.body.user.id as string,
    };
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.DEMO_MODE = 'true';
    process.env.CRON_SECRET = 'cron-test';
    delete process.env.MP_ACCESS_TOKEN;
    delete process.env.MP_WEBHOOK_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    http = request(app.getHttpServer());
    prisma = app.get(PrismaService);

    await prisma.$executeRawUnsafe(
      'TRUNCATE "Payment","WaitlistEntry","Appointment","ScheduleBlock","WorkingHour","BarberService","Barber","Service","User" CASCADE',
    );

    const service = await prisma.service.create({
      data: {
        name: 'Corte',
        durationMinutes: 40,
        bufferMinutes: 10,
        price: 9000,
      },
    });
    const user = await prisma.user.create({
      data: {
        email: 'barbero@test.com',
        fullName: 'Barbero Test',
        password: 'x',
        role: 'BARBER',
      },
    });
    const barber = await prisma.barber.create({
      data: { userId: user.id, displayName: 'Nacho' },
    });
    await prisma.barberService.create({
      data: { barberId: barber.id, serviceId: service.id },
    });
    await prisma.workingHour.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        barberId: barber.id,
        dayOfWeek,
        startTime: '08:00',
        endTime: '22:00',
      })),
    });

    serviceId = service.id;
    barberId = barber.id;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.MP_ACCESS_TOKEN;
  });

  describe('Seguridad', () => {
    it('no deja registrarse como ADMIN', async () => {
      await http
        .post('/v1/auth/register')
        .send({
          fullName: 'Hacker',
          email: 'hacker@test.com',
          password: 'secreto123',
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('un cliente no puede ver todos los turnos', async () => {
      const client = await newClient();
      await http.get('/v1/appointments').set(auth(client.token)).expect(403);
    });
  });

  describe('Reservas', () => {
    it('evita la doble reserva aunque 8 clientes reserven el mismo horario a la vez', async () => {
      const clients = await Promise.all(
        Array.from({ length: 8 }, () => newClient('Carrera')),
      );

      const responses = await Promise.all(
        clients.map((client) =>
          http
            .post('/v1/appointments')
            .set(auth(client.token))
            .send({ barberId, serviceId, startAt: slot('09:00') }),
        ),
      );

      const statuses = responses.map((res) => res.status).sort();
      expect(statuses.filter((status) => status === 201)).toHaveLength(1);
      expect(statuses.filter((status) => status === 400)).toHaveLength(7);

      const saved = await prisma.appointment.count({
        where: {
          barberId,
          startAt: new Date(slot('09:00')),
          status: { not: 'CANCELLED' },
        },
      });
      expect(saved).toBe(1);
    });

    it('respeta el margen del turno anterior', async () => {
      const client = await newClient();
      // El turno de las 09:00 dura 40 min + 10 de margen → ocupa hasta las 09:50.
      const res = await http
        .post('/v1/appointments')
        .set(auth(client.token))
        .send({ barberId, serviceId, startAt: slot('09:45') })
        .expect(400);
      expect(res.body.message).toContain('ya no está disponible');
    });

    it('rechaza turnos fuera del horario laboral (en hora de Argentina)', async () => {
      const client = await newClient();
      await http
        .post('/v1/appointments')
        .set(auth(client.token))
        .send({ barberId, serviceId, startAt: slot('21:40') })
        .expect(400);
    });

    it('la disponibilidad ya no ofrece el horario reservado', async () => {
      const res = await http
        .get(
          `/v1/availability?barberId=${barberId}&serviceId=${serviceId}&date=${date}`,
        )
        .expect(200);
      const labels = res.body.slots.map((s: { label: string }) => s.label);
      expect(labels[0]).toBe('08:00');
      expect(labels).not.toContain('09:00');
    });
  });

  describe('Reprogramar y lista de espera', () => {
    it('el cliente reprograma su turno y se avisa a la lista de espera', async () => {
      const owner = await newClient('Dueño');
      const waiting = await newClient('Esperando');
      const stranger = await newClient('Otro');

      const booked = await http
        .post('/v1/appointments')
        .set(auth(owner.token))
        .send({ barberId, serviceId, startAt: slot('12:00') })
        .expect(201);

      await http
        .post('/v1/waitlist')
        .set(auth(waiting.token))
        .send({ serviceId, date })
        .expect(201);

      await http
        .patch(`/v1/appointments/${booked.body.id}/reschedule`)
        .set(auth(stranger.token))
        .send({ startAt: slot('14:00') })
        .expect(403);

      const moved = await http
        .patch(`/v1/appointments/${booked.body.id}/reschedule`)
        .set(auth(owner.token))
        .send({ startAt: slot('14:00') })
        .expect(200);

      expect(new Date(moved.body.startAt).toISOString()).toBe(
        new Date(slot('14:00')).toISOString(),
      );
      expect(moved.body.rescheduleCount).toBe(1);

      const entry = await prisma.waitlistEntry.findFirst({
        where: { clientId: waiting.id },
      });
      expect(entry?.notifiedAt).not.toBeNull();
    });

    it('no deja reprogramar más de 2 veces', async () => {
      const owner = await newClient();
      const booked = await http
        .post('/v1/appointments')
        .set(auth(owner.token))
        .send({ barberId, serviceId, startAt: slot('16:00') })
        .expect(201);

      for (const time of ['16:50', '17:40']) {
        await http
          .patch(`/v1/appointments/${booked.body.id}/reschedule`)
          .set(auth(owner.token))
          .send({ startAt: slot(time) })
          .expect(200);
      }

      const res = await http
        .patch(`/v1/appointments/${booked.body.id}/reschedule`)
        .set(auth(owner.token))
        .send({ startAt: slot('18:30') })
        .expect(400);
      expect(res.body.message).toContain('2 veces');
    });
  });

  describe('Modo demo', () => {
    let demoToken: string;

    beforeAll(async () => {
      const res = await http.post('/v1/auth/demo').expect(200);
      demoToken = res.body.accessToken;
      expect(res.body.user.isDemo).toBe(true);
    });

    it('puede leer el panel pero con los datos de los clientes ocultos', async () => {
      const res = await http
        .get('/v1/appointments')
        .set(auth(demoToken))
        .expect(200);
      expect(res.body.length).toBeGreaterThan(0);

      for (const appointment of res.body) {
        expect(appointment.client.email).toMatch(/•••/);
        expect(appointment.client.fullName).toMatch(/^Cliente [A-Z0-9]{4}$/);
      }
    });

    it('no puede modificar nada', async () => {
      await http
        .post('/v1/services')
        .set(auth(demoToken))
        .send({ name: 'Hack', durationMinutes: 10, price: 1 })
        .expect(403);

      const appointment = await prisma.appointment.findFirstOrThrow({
        where: { status: 'CONFIRMED' },
      });
      await http
        .patch(`/v1/appointments/${appointment.id}/cancel`)
        .set(auth(demoToken))
        .send({})
        .expect(403);
    });

    it('no se puede entrar a la cuenta demo con contraseña', async () => {
      await http
        .post('/v1/auth/login')
        .send({ email: 'demo@barberflow.app', password: 'secreto123' })
        .expect(401);
    });
  });

  describe('Seña con Mercado Pago (simulado)', () => {
    function mockMercadoPago(paymentStatus: string) {
      const realFetch = global.fetch;
      return jest
        .spyOn(global, 'fetch')
        .mockImplementation(async (input, init) => {
          const url = input instanceof Request ? input.url : input.toString();
          if (url === 'https://mp.test/checkout/preferences') {
            const body = JSON.parse(init?.body as string) as {
              external_reference: string;
            };
            return new Response(
              JSON.stringify({
                id: `pref-${body.external_reference}`,
                init_point: 'https://mp.test/checkout',
              }),
              { status: 201 },
            );
          }
          const match = url.match(/^https:\/\/mp\.test\/v1\/payments\/(.+)$/);
          if (match) {
            const appointment = await prisma.payment.findFirstOrThrow({
              orderBy: { createdAt: 'desc' },
            });
            return new Response(
              JSON.stringify({
                id: match[1],
                status: paymentStatus,
                external_reference: appointment.appointmentId,
              }),
              { status: 200 },
            );
          }
          return realFetch(input, init);
        });
    }

    it('reserva con seña: queda pendiente y se confirma cuando Mercado Pago avisa el pago', async () => {
      process.env.MP_ACCESS_TOKEN = 'TEST-token';
      process.env.MP_WEBHOOK_SECRET = 'webhook-secret';
      mockMercadoPago('approved');
      const client = await newClient('Paga');

      const booked = await http
        .post('/v1/appointments')
        .set(auth(client.token))
        .send({ barberId, serviceId, startAt: slot('19:00') })
        .expect(201);

      expect(booked.body.status).toBe('PENDING');
      expect(booked.body.payment.checkoutUrl).toBe('https://mp.test/checkout');
      expect(Number(booked.body.payment.amount)).toBe(2700); // 30 % de $9000

      // Webhook sin firma válida → rechazado
      await http
        .post('/v1/payments/webhook?type=payment&data.id=555')
        .send({})
        .expect(401);

      const ts = '1700000000';
      const v1 = createHmac('sha256', 'webhook-secret')
        .update(`id:555;request-id:req-1;ts:${ts};`)
        .digest('hex');
      await http
        .post('/v1/payments/webhook?type=payment&data.id=555')
        .set('x-signature', `ts=${ts},v1=${v1}`)
        .set('x-request-id', 'req-1')
        .send({ type: 'payment', data: { id: '555' } })
        .expect(200);

      const saved = await prisma.appointment.findUniqueOrThrow({
        where: { id: booked.body.id },
        include: { payment: true },
      });
      expect(saved.status).toBe('CONFIRMED');
      expect(saved.payment?.status).toBe('APPROVED');
      delete process.env.MP_WEBHOOK_SECRET;
    });

    it('si la seña no se paga a tiempo, el turno se cancela y el horario se libera', async () => {
      process.env.MP_ACCESS_TOKEN = 'TEST-token';
      mockMercadoPago('pending');
      const client = await newClient('NoPaga');

      const booked = await http
        .post('/v1/appointments')
        .set(auth(client.token))
        .send({ barberId, serviceId, startAt: slot('20:00') })
        .expect(201);

      await prisma.payment.update({
        where: { appointmentId: booked.body.id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      await http.post('/v1/jobs/run').expect(401);
      const run = await http
        .post('/v1/jobs/run')
        .set('x-cron-secret', 'cron-test')
        .expect(200);
      expect(run.body.expiredDeposits).toBe(1);

      const saved = await prisma.appointment.findUniqueOrThrow({
        where: { id: booked.body.id },
      });
      expect(saved.status).toBe('CANCELLED');
      expect(saved.cancelReason).toContain('Seña');
    });
  });

  describe('Recordatorios', () => {
    it('manda el recordatorio una sola vez, un día antes', async () => {
      const client = await newClient('Recordar');
      const startAt = new Date(Date.now() + 23 * 3_600_000);
      startAt.setUTCMinutes(0, 0, 0);

      const appointment = await prisma.appointment.create({
        data: {
          clientId: client.id,
          barberId,
          serviceId,
          startAt,
          endAt: new Date(startAt.getTime() + 40 * 60_000),
          status: 'CONFIRMED',
          createdAt: new Date(Date.now() - 3 * 86_400_000),
        },
      });

      const jobs = app.get(JobsService);
      const first = await jobs.runAll();
      const second = await jobs.runAll();

      expect(first).toMatchObject({ reminders: { processed: 1 } });
      expect(second).toMatchObject({ reminders: { processed: 0 } });

      const saved = await prisma.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
      });
      expect(saved.reminderSentAt).not.toBeNull();
    });
  });

  it('las métricas públicas no exponen datos personales', async () => {
    const res = await http.get('/v1/stats/public').expect(200);
    expect(res.body.appointmentsManaged).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/@/);
  });
});
