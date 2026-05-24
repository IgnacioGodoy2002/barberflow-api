import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAdminAppointmentDto {
  @ApiProperty({
    example: 'Ignacio Godoy',
  })
  @IsString()
  @IsNotEmpty()
  clientFullName!: string;

  @ApiProperty({
    example: 'cliente@gmail.com',
  })
  @IsEmail()
  clientEmail!: string;

  @ApiPropertyOptional({
    example: '1123456789',
  })
  @IsOptional()
  @IsString()
  clientPhone?: string;

  @ApiProperty({
    example: 'id-del-barbero',
  })
  @IsUUID()
  barberId!: string;

  @ApiProperty({
    example: 'id-del-servicio',
  })
  @IsUUID()
  serviceId!: string;

  @ApiProperty({
    example: '2026-05-25T15:00:00',
    description: 'Fecha y hora de inicio del turno',
  })
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional({
    example: 'Turno cargado manualmente desde WhatsApp.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}