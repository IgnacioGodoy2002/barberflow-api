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
import { AssignServicesDto } from './dto/assign-services.dto';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import { BarbersService } from './barbers.service';

@ApiTags('Barbers')
@Controller('barbers')
export class BarbersController {
  constructor(private readonly barbersService: BarbersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar barberos activos' })
  findAll() {
    return this.barbersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un barbero por ID' })
  findOne(@Param('id') id: string) {
    return this.barbersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear perfil de barbero' })
  create(@Body() dto: CreateBarberDto) {
    return this.barbersService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar perfil de barbero' })
  update(@Param('id') id: string, @Body() dto: UpdateBarberDto) {
    return this.barbersService.update(id, dto);
  }

  @Post(':id/services')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Asignar servicios a un barbero' })
  assignServices(@Param('id') id: string, @Body() dto: AssignServicesDto) {
    return this.barbersService.assignServices(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar barbero' })
  remove(@Param('id') id: string) {
    return this.barbersService.remove(id);
  }
}