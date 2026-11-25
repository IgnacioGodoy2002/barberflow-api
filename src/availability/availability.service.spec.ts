import { AvailabilityService } from './availability.service';
import type { PrismaService } from '../prisma/prisma.service';

const SERVICE = {
  id: 's1',
  name: 'Corte',
  isActive: true,
  durationMinutes: 40,
  bufferMinutes: 10,
  price: 9000,
};
const BARBER = { id: 'b1', isActive: true, services: [{ serviceId: 's1' }] };
const DATE = '2026-12-02'; // miércoles

function at(time: string) {
  return new Date(`${DATE}T${time}:00-03:00`);
}

function buildService(
  overrides: {
    appointments?: {
      startAt: Date;
      endAt: Date;
      status: string;
      service: { bufferMinutes: number };
    }[];
    blocks?: { startAt: Date; endAt: Date }[];
    workingHours?: { startTime: string; endTime: string }[];
  } = {},
) {
  const prisma = {
    service: { findUnique: jest.fn().mockResolvedValue(SERVICE) },
    barber: { findUnique: jest.fn().mockResolvedValue(BARBER) },
    workingHour: {
      findMany: jest
        .fn()
        .mockResolvedValue(
          overrides.workingHours ?? [{ startTime: '10:00', endTime: '13:00' }],
        ),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue(overrides.appointments ?? []),
    },
    scheduleBlock: {
      findMany: jest.fn().mockResolvedValue(overrides.blocks ?? []),
    },
  };

  return {
    service: new AvailabilityService(prisma as unknown as PrismaService),
    prisma,
  };
}

const query = { barberId: 'b1', serviceId: 's1', date: DATE };

describe('AvailabilityService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-01T12:00:00-03:00'));
  });

  afterEach(() => jest.useRealTimers());

  it('arma los horarios del día respetando duración + margen', async () => {
    const { service } = buildService();
    const result = await service.getAvailability(query);

    // 10:00–13:00 con turnos de 40 min + 10 de margen → 10:00, 10:50, 11:40 (12:30 + 40 > 13:00)
    expect(result.slots.map((slot) => slot.label)).toEqual([
      '10:00',
      '10:50',
      '11:40',
    ]);
  });

  it('busca los horarios laborales del día de la semana correcto (hora de Argentina)', async () => {
    const { service, prisma } = buildService();
    await service.getAvailability(query);

    expect(prisma.workingHour.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dayOfWeek: 3 }),
      }),
    );
  });

  it('saca los horarios que se pisan con un turno, incluido su margen', async () => {
    const { service } = buildService({
      appointments: [
        {
          startAt: at('10:20'),
          endAt: at('11:00'),
          status: 'CONFIRMED',
          service: { bufferMinutes: 10 },
        },
      ],
    });
    const result = await service.getAvailability(query);

    // El turno ocupa 10:20–11:10: se caen 10:00 y 10:50.
    expect(result.slots.map((slot) => slot.label)).toEqual(['11:40']);
  });

  it('ignora turnos cancelados y ausentes', async () => {
    const { service } = buildService({
      appointments: [
        {
          startAt: at('10:00'),
          endAt: at('10:40'),
          status: 'CANCELLED',
          service: { bufferMinutes: 10 },
        },
        {
          startAt: at('10:50'),
          endAt: at('11:30'),
          status: 'NO_SHOW',
          service: { bufferMinutes: 10 },
        },
      ],
    });
    const result = await service.getAvailability(query);

    expect(result.totalSlots).toBe(3);
  });

  it('cuenta los turnos con seña pendiente como ocupados', async () => {
    const { service } = buildService({
      appointments: [
        {
          startAt: at('10:00'),
          endAt: at('10:40'),
          status: 'PENDING',
          service: { bufferMinutes: 10 },
        },
      ],
    });
    const result = await service.getAvailability(query);

    expect(result.slots.map((slot) => slot.label)).toEqual(['10:50', '11:40']);
  });

  it('respeta los bloqueos de agenda', async () => {
    const { service } = buildService({
      blocks: [{ startAt: at('11:30'), endAt: at('13:00') }],
    });
    const result = await service.getAvailability(query);

    expect(result.slots.map((slot) => slot.label)).toEqual(['10:00']);
  });

  it('no ofrece horarios que ya pasaron', async () => {
    jest.setSystemTime(at('10:30'));
    const { service } = buildService();
    const result = await service.getAvailability(query);

    expect(result.slots.map((slot) => slot.label)).toEqual(['10:50', '11:40']);
  });

  it('rechaza un barbero que no hace ese servicio', async () => {
    const { service, prisma } = buildService();
    prisma.barber.findUnique.mockResolvedValue({ ...BARBER, services: [] });

    await expect(service.getAvailability(query)).rejects.toThrow(
      'no tiene asignado este servicio',
    );
  });
});
