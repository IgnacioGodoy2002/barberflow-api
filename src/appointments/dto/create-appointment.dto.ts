import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({
    example: 'id-del-barbero',
  })
  @IsUUID()
  barberId: string;

  @ApiProperty({
    example: 'id-del-servicio',
  })
  @IsUUID()
  serviceId: string;

  @ApiProperty({
    example: '2026-05-18T09:00:00',
    description: 'Fecha y hora de inicio del turno',
  })
  @IsDateString()
  startAt: string;

  @ApiPropertyOptional({
    example: 'Cliente quiere corte clásico con barba prolija.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}