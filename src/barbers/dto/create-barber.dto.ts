import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateBarberDto {
  @ApiProperty({
    example: 'id-del-usuario-con-rol-barber',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    example: 'Nacho Barber',
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    example: 'Barbero y colorista especializado en cortes modernos, barba y color.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    example: ['id-servicio-1', 'id-servicio-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  serviceIds?: string[];
}