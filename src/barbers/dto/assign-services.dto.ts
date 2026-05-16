import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignServicesDto {
  @ApiProperty({
    example: ['id-servicio-1', 'id-servicio-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds: string[];
}