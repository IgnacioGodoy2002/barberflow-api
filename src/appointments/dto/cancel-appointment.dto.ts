import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelAppointmentDto {
  @ApiPropertyOptional({
    example: 'No puedo asistir al turno.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}