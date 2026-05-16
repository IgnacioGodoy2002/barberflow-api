import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
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
}