import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('config')
  @ApiOperation({ summary: 'Saber si se cobra seña y de cuánto es' })
  config() {
    return this.paymentsService.getPublicConfig();
  }

  @Get('appointment/:appointmentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ver la seña de un turno (para retomar el pago)' })
  findForAppointment(
    @Param('appointmentId') appointmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.findForAppointment(appointmentId, user);
  }

  /** Lo llama Mercado Pago. Responde 200 rápido para que no reintente de más. */
  @Post('webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(
    @Query('type') queryType: string | undefined,
    @Query('data.id') queryDataId: string | undefined,
    @Body() body: { type?: string; data?: { id?: string | number } },
    @Headers('x-signature') signatureHeader?: string,
    @Headers('x-request-id') requestId?: string,
  ) {
    return this.paymentsService.handleWebhook({
      type: queryType ?? body?.type,
      dataId:
        queryDataId ??
        (body?.data?.id !== undefined ? String(body.data.id) : undefined),
      signatureHeader,
      requestId,
    });
  }
}
