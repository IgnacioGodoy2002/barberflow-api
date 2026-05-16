import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWorkingHourDto } from './dto/create-working-hour.dto';
import { UpdateWorkingHourDto } from './dto/update-working-hour.dto';
import { WorkingHoursService } from './working-hours.service';

@ApiTags('Working Hours')
@Controller('working-hours')
export class WorkingHoursController {
  constructor(private readonly workingHoursService: WorkingHoursService) {}

  @Get('barber/:barberId')
  @ApiOperation({ summary: 'Listar horarios activos de un barbero' })
  findByBarber(@Param('barberId') barberId: string) {
    return this.workingHoursService.findByBarber(barberId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear horario de trabajo para un barbero' })
  create(@Body() dto: CreateWorkingHourDto) {
    return this.workingHoursService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar horario de trabajo' })
  update(@Param('id') id: string, @Body() dto: UpdateWorkingHourDto) {
    return this.workingHoursService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar horario de trabajo' })
  remove(@Param('id') id: string) {
    return this.workingHoursService.remove(id);
  }
}