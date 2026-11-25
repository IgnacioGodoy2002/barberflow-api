import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentsService } from '../payments/payments.service';
import { RemindersService } from './reminders.service';

/**
 * Tareas en segundo plano.
 * Corren solas cada 10 minutos mientras el servidor está despierto, y también
 * se pueden disparar desde afuera con POST /v1/jobs/run (lo hace el workflow
 * de GitHub Actions que mantiene despierto el servidor de Render).
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private running = false;

  constructor(
    private readonly reminders: RemindersService,
    private readonly payments: PaymentsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'barberflow-jobs',
    disabled: process.env.NODE_ENV === 'test',
  })
  async scheduledRun() {
    await this.runAll();
  }

  async runAll() {
    // Evita que el cron y una llamada externa se pisen.
    if (this.running) return { skipped: true };
    this.running = true;

    try {
      const expiredDeposits = await this.payments.expireUnpaid();
      const reminders = await this.reminders.sendDueReminders();
      return { expiredDeposits, reminders, ranAt: new Date().toISOString() };
    } catch (error) {
      this.logger.error(
        `Falló una tarea programada: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      this.running = false;
    }
  }
}
