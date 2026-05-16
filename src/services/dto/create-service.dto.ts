import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  durationMinutes: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  bufferMinutes: number = 10;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;
}