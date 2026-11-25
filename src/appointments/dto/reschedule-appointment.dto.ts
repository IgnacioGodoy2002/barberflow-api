import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({
    example: '2026-12-05T11:00:00-03:00',
    description: 'Nuevo horario (uno de los que devuelve /availability)',
  })
  @IsDateString()
  startAt!: string;
}
