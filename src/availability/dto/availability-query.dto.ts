import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

export class AvailabilityQueryDto {
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
    example: '2026-05-18',
    description: 'Fecha a consultar en formato YYYY-MM-DD',
  })
  @IsDateString()
  date: string;
}