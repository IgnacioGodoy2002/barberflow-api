import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { applyBusinessTimezone } from './common/timezone';

async function bootstrap() {
  // Debe ir antes que cualquier cálculo de fechas (Render corre en UTC).
  applyBusinessTimezone();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('BarberFlow API')
    .setDescription(
      'API REST para gestión de turnos de barbería: clientes, servicios, barberos, disponibilidad, reservas con seña (Mercado Pago), reprogramación, lista de espera y recordatorios.',
    )
    .setVersion('1.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();
