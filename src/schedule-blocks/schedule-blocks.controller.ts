import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { ScheduleBlocksService } from './schedule-blocks.service';

@ApiTags('Schedule Blocks')
@Controller('schedule-blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'BARBER')
@ApiBearerAuth()
export class ScheduleBlocksController {
  constructor(private readonly scheduleBlocksService: ScheduleBlocksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear bloqueo de agenda para un barbero' })
  create(@Body() dto: CreateScheduleBlockDto, @CurrentUser() user: any) {
    return this.scheduleBlocksService.create(dto, user);
  }

  @Get('barber/:barberId')
  @ApiOperation({ summary: 'Listar bloqueos activos de un barbero' })
  findByBarber(@Param('barberId') barberId: string, @CurrentUser() user: any) {
    return this.scheduleBlocksService.findByBarber(barberId, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desactivar bloqueo de agenda' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.scheduleBlocksService.remove(id, user);
  }
}