import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InstagramTokenRefreshService } from '../services/instagram-token-refresh.service';

/**
 * Scheduler para renovação automática de tokens do Instagram
 * 
 * Executa a cada 24 horas para verificar e renovar tokens que estão próximos de expirar
 */
@Injectable()
export class InstagramTokenRefreshScheduler {
  private readonly logger = new Logger(InstagramTokenRefreshScheduler.name);

  constructor(
    private readonly tokenRefreshService: InstagramTokenRefreshService,
  ) {}

  /**
   * Executa renovação automática de tokens a cada 24 horas
   * Horário: 03:00 AM (horário de menor tráfego)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleTokenRefresh() {
    this.logger.log('Running scheduled Instagram token refresh...');
    
    try {
      await this.tokenRefreshService.refreshExpiredTokens();
      this.logger.log('Scheduled token refresh completed successfully');
    } catch (error) {
      this.logger.error('Scheduled token refresh failed:', error);
    }
  }
}
