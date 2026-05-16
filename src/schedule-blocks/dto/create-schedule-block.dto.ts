import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export type ScheduleBlockType =
  | 'PERSONAL'
  | 'VACATION'
  | 'SICKNESS'
  | 'BREAK'
  | 'OTHER';

export class CreateScheduleBlockDto {
  @ApiProperty({
    example: 'id-del-barbero',
  })
  @IsUUID()
  barberId: string;

  @ApiProperty({
    example: '2026-05-18T18:00:00.000Z',
  })
  @IsDateString()
  startAt: string;

  @ApiProperty({
    example: '2026-05-18T19:00:00.000Z',
  })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({
    example: 'BREAK',
    enum: ['PERSONAL', 'VACATION', 'SICKNESS', 'BREAK', 'OTHER'],
  })
  @IsOptional()
  @IsIn(['PERSONAL', 'VACATION', 'SICKNESS', 'BREAK', 'OTHER'])
  type?: ScheduleBlockType;

  @ApiPropertyOptional({
    example: 'Bloqueo por descanso.',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}