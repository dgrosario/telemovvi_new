import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MainDatabaseService } from '../database/main-database.service';

/**
 * Serviço para renovar tokens de acesso do Instagram automaticamente
 * 
 * Instagram long-lived tokens duram 60 dias e podem ser renovados antes de expirar.
 * Este serviço verifica e renova tokens que estão próximos de expirar.
 */
@Injectable()
export class InstagramTokenRefreshService {
  private readonly logger = new Logger(InstagramTokenRefreshService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mainDatabaseService: MainDatabaseService,
  ) {}

  /**
   * Executa diariamente às 3h da manhã para renovar tokens
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCron() {
    this.logger.log('Starting Instagram token refresh check...');
    await this.refreshExpiredTokens();
  }

  /**
   * Renova tokens que estão próximos de expirar (menos de 7 dias)
   */
  async refreshExpiredTokens(): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn('Database connection not available');
      return;
    }

    try {
      // Busca canais Instagram com tokens que expiram em menos de 7 dias
      const channels = await sql<
        Array<{
          id: string;
          payload: {
            accessToken?: string;
            tokenExpiresAt?: string;
            instagramId?: string;
            pageId?: string;
          };
        }>
      >`
        SELECT id, payload
        FROM channels
        WHERE type = 'instagram'
          AND payload->>'accessToken' IS NOT NULL
          AND (
            payload->>'tokenExpiresAt' IS NULL
            OR (payload->>'tokenExpiresAt')::timestamp < NOW() + INTERVAL '7 days'
          )
      `;

      this.logger.log(`Found ${channels.length} Instagram channels to refresh`);

      for (const channel of channels) {
        try {
          await this.refreshChannelToken(channel.id, channel.payload);
        } catch (error) {
          this.logger.error(
            `Failed to refresh token for channel ${channel.id}:`,
            error,
          );
        }
      }

      this.logger.log('Instagram token refresh check completed');
    } catch (error) {
      this.logger.error('Error during token refresh:', error);
    }
  }

  /**
   * Renova o token de um canal específico
   */
  private async refreshChannelToken(
    channelId: string,
    payload: {
      accessToken?: string;
      tokenExpiresAt?: string;
      instagramId?: string;
      pageId?: string;
    },
  ): Promise<void> {
    const accessToken = payload.accessToken;

    if (!accessToken) {
      this.logger.warn(`Channel ${channelId} has no access token`);
      return;
    }

    this.logger.log(`Refreshing token for channel ${channelId}...`);

    try {
      // Chama a API do Instagram para renovar o token
      const response = await fetch(
        'https://graph.instagram.com/refresh_access_token?' +
          new URLSearchParams({
            grant_type: 'ig_refresh_token',
            access_token: accessToken,
          }),
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Failed to refresh token: ${error?.error?.message || 'Unknown error'}`,
        );
      }

      const data = await response.json();
      const newAccessToken = data.access_token;
      const expiresIn = data.expires_in; // Segundos até expirar

      if (!newAccessToken) {
        throw new Error('No access token in refresh response');
      }

      // Calcula data de expiração
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Atualiza token no banco de dados
      const sql = this.mainDatabaseService.getConnection();
      if (!sql) {
        throw new Error('Database connection not available');
      }

      await sql`
        UPDATE channels
        SET payload = jsonb_set(
          jsonb_set(
            payload,
            '{accessToken}',
            to_jsonb(${newAccessToken}::text)
          ),
          '{tokenExpiresAt}',
          to_jsonb(${expiresAt.toISOString()}::text)
        )
        WHERE id = ${channelId}
      `;

      this.logger.log(
        `✅ Token refreshed successfully for channel ${channelId}. Expires at: ${expiresAt.toISOString()}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to refresh token for channel ${channelId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Método público para forçar renovação de um canal específico
   */
  async forceRefreshChannel(channelId: string): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      throw new Error('Database connection not available');
    }

    const channels = await sql<
      Array<{
        id: string;
        payload: {
          accessToken?: string;
          tokenExpiresAt?: string;
          instagramId?: string;
          pageId?: string;
        };
      }>
    >`
      SELECT id, payload
      FROM channels
      WHERE id = ${channelId} AND type = 'instagram'
    `;

    if (channels.length === 0) {
      throw new Error(`Instagram channel ${channelId} not found`);
    }

    await this.refreshChannelToken(channels[0].id, channels[0].payload);
  }
}
