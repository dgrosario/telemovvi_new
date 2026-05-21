import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InstagramGatewayHandler } from "./handlers/instagram-gateway.handler";
import { MainDatabaseService } from "../database/main-database.service";

@Controller("instagram-channels")
export class InstagramChannelsController {
  private readonly logger = new Logger(InstagramChannelsController.name);

  constructor(
    private readonly instagramGatewayHandler: InstagramGatewayHandler,
    private readonly mainDatabaseService: MainDatabaseService
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listInstagramChannels() {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      throw new Error("Database connection not available");
    }

    const channels = await sql<
      Array<{
        id: string;
        name: string;
        type: string;
        status: string;
        payload: Record<string, unknown>;
      }>
    >`
      SELECT id, name, type, status, payload
      FROM channels
      WHERE type = 'instagram'
    `;

    return channels;
  }

  @Post(":channelId/update-info")
  @HttpCode(HttpStatus.OK)
  async updateChannelInfo(@Param("channelId") channelId: string) {
    try {
      this.logger.log(`Updating Instagram channel info for ${channelId}`);

      // Get channel from database
      const sql = this.mainDatabaseService.getConnection();
      if (!sql) {
        this.logger.error("Database connection not available");
        throw new Error("Database connection not available");
      }

      this.logger.debug(`Querying database for channel ${channelId}`);
      const channels = await sql<
        Array<{
          id: string;
          type: string;
          payload: { accessToken?: string };
        }>
      >`
        SELECT id, type, payload
        FROM channels
        WHERE id = ${channelId} AND type = 'instagram'
        LIMIT 1
      `;

      this.logger.debug(`Found ${channels.length} channels`);

      if (channels.length === 0) {
        this.logger.warn(`Instagram channel not found: ${channelId}`);
        throw new NotFoundException("Instagram channel not found");
      }

      const channel = channels[0];
      const accessToken = channel.payload.accessToken;

      if (!accessToken) {
        this.logger.error(`Channel ${channelId} has no access token`);
        throw new Error("Channel has no access token");
      }

      this.logger.log(`Calling Instagram API to update channel ${channelId}`);
      const result = await this.instagramGatewayHandler.updateChannelInfo(
        channelId,
        accessToken
      );

      if (!result.success) {
        this.logger.error(`Failed to update channel info: ${result.error}`);
        throw new Error(result.error || "Failed to update channel info");
      }

      this.logger.log(`Successfully updated channel ${channelId}: @${result.username}`);
      return {
        success: true,
        username: result.username,
        profilePictureUrl: result.profilePictureUrl,
      };
    } catch (error) {
      this.logger.error(`Error updating Instagram channel info: ${error instanceof Error ? error.message : "Unknown error"}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  @Post(":channelId/update-page-id")
  @HttpCode(HttpStatus.OK)
  async updatePageId(
    @Param("channelId") channelId: string,
    @Body() body: { pageId: string }
  ) {
    this.logger.log(
      `Updating Instagram channel pageId for ${channelId} to ${body.pageId}`
    );

    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      throw new Error("Database connection not available");
    }

    const channels = await sql<Array<{ id: string; payload: Record<string, unknown> }>>`
      SELECT id, payload
      FROM channels
      WHERE id = ${channelId} AND type = 'instagram'
      LIMIT 1
    `;

    if (channels.length === 0) {
      throw new NotFoundException("Instagram channel not found");
    }

    const channel = channels[0];
    const updatedPayload = {
      ...channel.payload,
      pageId: body.pageId,
      instagramBusinessAccountId: body.pageId,
    };

    await sql`
      UPDATE channels
      SET payload = ${sql.json(updatedPayload)}
      WHERE id = ${channelId}
    `;

    this.logger.log(`Successfully updated pageId for channel ${channelId}`);

    return {
      success: true,
      pageId: body.pageId,
    };
  }

  @Get("pending-page-id")
  @HttpCode(HttpStatus.OK)
  async getPendingPageIdChannels() {
    this.logger.log("Fetching Instagram channels with pending pageId discovery");

    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      throw new Error("Database connection not available");
    }

    // Get channels that were connected recently
    const channels = await sql<
      Array<{
        id: string;
        name: string;
        status: string;
        payload: Record<string, unknown>;
        updated_at: Date;
      }>
    >`
      SELECT id, name, status, payload, updated_at
      FROM channels
      WHERE type = 'instagram'
        AND status = 'connected'
        AND updated_at > NOW() - INTERVAL '24 hours'
      ORDER BY updated_at DESC
    `;

    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      status: channel.status,
      currentPageId: (channel.payload as { pageId?: string }).pageId,
      updatedAt: channel.updated_at,
    }));
  }

  @Get("debug")
  @HttpCode(HttpStatus.OK)
  async debugChannels() {
    this.logger.log("Fetching all Instagram channels for debug");

    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      throw new Error("Database connection not available");
    }

    const channels = await sql<
      Array<{
        id: string;
        name: string;
        status: string;
        payload: Record<string, unknown>;
      }>
    >`
      SELECT id, name, status, payload
      FROM channels
      WHERE type = 'instagram'
      ORDER BY created_at DESC
    `;

    return channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      status: channel.status,
      pageId: (channel.payload as { pageId?: string }).pageId,
      igUserId: (channel.payload as { igUserId?: string }).igUserId,
      instagramBusinessAccountId: (channel.payload as { instagramBusinessAccountId?: string }).instagramBusinessAccountId,
      username: (channel.payload as { username?: string }).username,
    }));
  }

  @Get("test-message")
  @HttpCode(HttpStatus.OK)
  async testMessage() {
    this.logger.log("Testing Instagram message processing");

    // Simula uma mensagem do Instagram para testar o fluxo completo
    const testPayload = {
      messageId: "test_" + Date.now(),
      senderId: "821655940503705",
      content: "Teste de mensagem",
      type: "text" as const,
      timestamp: Date.now(),
      contactName: "Teste",
      pageId: "17841408789972589",
    };

    this.logger.log(`Test payload: ${JSON.stringify(testPayload)}`);

    return {
      success: true,
      message: "Test message created",
      payload: testPayload,
    };
  }
}
