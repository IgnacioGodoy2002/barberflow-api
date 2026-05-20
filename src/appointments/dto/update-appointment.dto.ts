import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateAppointmentDto {
  @ApiPropertyOptional({
    example: 'id-del-barbero',
  })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiPropertyOptional({
    example: 'id-del-servicio',
  })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({
    example: '2026-05-18T10:00:00',
    description: 'Nueva fecha y hora de inicio del turno',
  })
  @IsOptional()
  @IsDateString()
  startAt?: string;

  @ApiPropertyOptional({
    example: 'Cliente quiere cambiar el horario.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}