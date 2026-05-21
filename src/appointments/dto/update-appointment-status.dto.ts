import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    example: 'COMPLETED',
    enum: ['CONFIRMED', 'COMPLETED', 'NO_SHOW'],
  })
  @IsIn(['CONFIRMED', 'COMPLETED', 'NO_SHOW'])
  status!: 'CONFIRMED' | 'COMPLETED' | 'NO_SHOW';
}