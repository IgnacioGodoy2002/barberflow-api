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
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateWaitlistEntryDto } from './dto/create-waitlist-entry.dto';
import { WaitlistService } from './waitlist.service';

@ApiTags('Waitlist')
@Controller('waitlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @ApiOperation({
    summary: 'Anotarme para que me avisen si se libera un turno ese día',
  })
  join(@Body() dto: CreateWaitlistEntryDto, @CurrentUser() user: AuthUser) {
    return this.waitlistService.join(dto, user);
  }

  @Get('my')
  @ApiOperation({ summary: 'Mis inscripciones en lista de espera' })
  findMine(@CurrentUser() user: AuthUser) {
    return this.waitlistService.findMine(user);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'BARBER')
  @ApiOperation({ summary: 'Lista de espera completa (admin)' })
  findAll() {
    return this.waitlistService.findAll();
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Salir de la lista de espera' })
  leave(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.waitlistService.leave(id, user);
  }
}
