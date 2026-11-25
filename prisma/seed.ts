/**
 * Datos de ejemplo para desarrollo local y Docker.
 * Uso: npm run db:seed
 * NO correr contra la base de producción.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('El seed es solo para desarrollo');
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@barberflow.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      fullName: 'Admin BarberFlow',
      password: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
    },
  });

  const services = await Promise.all(
    [
      {
        name: 'Corte + degradé',
        description: 'Corte a tijera y máquina con degradé prolijo.',
        durationMinutes: 40,
        bufferMinutes: 10,
        price: 9000,
      },
      {
        name: 'Barba y perfilado',
        description: 'Perfilado con navaja y toalla caliente.',
        durationMinutes: 20,
        bufferMinutes: 5,
        price: 5000,
      },
      {
        name: 'Color global',
        description: 'Decoloración y color a elección.',
        durationMinutes: 120,
        bufferMinutes: 15,
        price: 25000,
      },
    ].map(async (data) => {
      const existing = await prisma.service.findFirst({
        where: { name: data.name },
      });
      return existing ?? prisma.service.create({ data });
    }),
  );

  const barbersData = [
    {
      email: 'nacho@barberflow.local',
      fullName: 'Nacho Godoy',
      displayName: 'Nacho',
      bio: 'Especialista en degradés y color.',
      services,
    },
    {
      email: 'rodri@barberflow.local',
      fullName: 'Rodrigo Pérez',
      displayName: 'Rodri',
      bio: 'Cortes clásicos y barba.',
      services: services.slice(0, 2),
    },
  ];

  for (const data of barbersData) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        fullName: data.fullName,
        password: await bcrypt.hash('barber123', 10),
        role: 'BARBER',
      },
    });

    const barber = await prisma.barber.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, displayName: data.displayName, bio: data.bio },
    });

    for (const service of data.services) {
      await prisma.barberService.upsert({
        where: {
          barberId_serviceId: { barberId: barber.id, serviceId: service.id },
        },
        update: {},
        create: { barberId: barber.id, serviceId: service.id },
      });
    }

    const hasHours = await prisma.workingHour.count({
      where: { barberId: barber.id },
    });
    if (!hasHours) {
      await prisma.workingHour.createMany({
        data: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          barberId: barber.id,
          dayOfWeek,
          startTime: '10:00',
          endTime: dayOfWeek === 6 ? '18:00' : '20:00',
        })),
      });
    }
  }

  console.log(`Seed listo. Admin: ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
