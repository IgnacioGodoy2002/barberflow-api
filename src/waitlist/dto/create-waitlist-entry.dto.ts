import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateWaitlistEntryDto {
  @ApiProperty({ example: 'id-del-servicio' })
  @IsUUID()
  serviceId!: string;

  @ApiPropertyOptional({
    example: 'id-del-barbero',
    description: 'Vacío = cualquier barbero',
  })
  @IsOptional()
  @IsUUID()
  barberId?: string;

  @ApiProperty({
    example: '2026-12-05',
    description: 'Día buscado (YYYY-MM-DD)',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha debe tener formato YYYY-MM-DD',
  })
  date!: string;
}
