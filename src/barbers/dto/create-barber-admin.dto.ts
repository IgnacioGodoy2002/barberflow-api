import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateBarberAdminDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'juanbarber@test.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Juan Barber' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiProperty({
    example: 'Barbero especializado en cortes modernos, barba y perfilado.',
  })
  @IsString()
  @IsNotEmpty()
  bio: string;
}