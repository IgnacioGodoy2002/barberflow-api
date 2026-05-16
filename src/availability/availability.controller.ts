import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';

@ApiTags('Availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar horarios disponibles por barbero, servicio y fecha',
  })
  getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.availabilityService.getAvailability(query);
  }
}