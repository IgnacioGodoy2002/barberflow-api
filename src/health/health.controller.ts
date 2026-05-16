import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar que la API esté funcionando' })
  checkHealth() {
    return {
      status: 'ok',
      app: 'BarberFlow API',
      version: '1.0.0',
      message: 'API funcionando correctamente',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db')
  @ApiOperation({ summary: 'Verificar conexión con la base de datos' })
  async checkDatabase() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      database: 'connected',
      message: 'Conexión a PostgreSQL funcionando correctamente',
      timestamp: new Date().toISOString(),
    };
  }
}