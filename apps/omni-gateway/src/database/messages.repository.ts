import { Injectable, Logger } from "@nestjs/common";
import { MainDatabaseService } from "./main-database.service";

export interface MediaRecoveryMessage {
  id: string;
  type: string;
  mimetype: string | null;
  content: string | null;
  remoteJid: string | null;
  channelId: string;
  channelType: string;
  channelPayload: Record<string, unknown>;
}

@Injectable()
export class MessagesRepository {
  private readonly logger = new Logger(MessagesRepository.name);

  constructor(private readonly mainDatabaseService: MainDatabaseService) {}

  async updateStatus(messageId: string, status: string): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available, skipping status update");
      return;
    }

    try {
      await sql`UPDATE messages SET status = ${status} WHERE id = ${messageId}`;
    } catch (error) {
      this.logger.error(`Error updating message status: ${messageId}`, error);
    }
  }

  async updateMediaPath(messageId: string, mediaPath: string): Promise<void> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available, skipping media_path update");
      return;
    }

    try {
      await sql`UPDATE messages SET media_path = ${mediaPath} WHERE id = ${messageId}`;
    } catch (error) {
      this.logger.error(`Error updating media_path: ${messageId}`, error);
    }
  }

  async clearMediaPaths(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available, skipping media_path cleanup");
      return;
    }

    try {
      await sql`
        UPDATE messages
        SET media_path = NULL
        WHERE id = ANY(${messageIds})
          AND media_path IS NOT NULL
      `;
      this.logger.log(`Cleared media_path for ${messageIds.length} messages`);
    } catch (error) {
      this.logger.error("Error clearing media_paths:", error);
    }
  }

  async updateMediaPathForSiblings(
    originalMessageId: string,
    mediaPath: string
  ): Promise<number> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available, skipping siblings update");
      return 0;
    }

    try {
      const pattern = `${originalMessageId}:%`;
      const result = await sql`
        UPDATE messages
        SET media_path = ${mediaPath}
        WHERE id LIKE ${pattern}
          AND media_path IS NULL
      `;
      const count = result.count ?? 0;
      if (count > 0) {
        this.logger.debug(
          `Updated media_path for ${count} sibling messages of ${originalMessageId}`
        );
      }
      return count;
    } catch (error) {
      this.logger.error(
        `Error updating siblings media_path for ${originalMessageId}:`,
        error
      );
      return 0;
    }
  }

  async findMessagesNeedingMediaRecovery(
    limit = 100
  ): Promise<MediaRecoveryMessage[]> {
    const sql = this.mainDatabaseService.getConnection();
    if (!sql) {
      this.logger.warn("Database not available");
      return [];
    }

    try {
      const rows = await sql`
        SELECT
          m.id,
          m.type,
          m.mimetype,
          m.content,
          m.sender_type,
          COALESCE(
            conv.group_jid,
            pc.value || '@s.whatsapp.net'
          ) as remote_jid,
          c.id as channel_id,
          c.type as channel_type,
          c.payload as channel_payload
        FROM messages m
        JOIN conversations conv ON conv.id = m.conversation_id
        LEFT JOIN partner_contacts pc ON pc.id = conv.contact
        JOIN channels c ON c.id = CASE
          WHEN m.sender_type = 'contact' THEN COALESCE(conv.received_channel_id, conv.channel)
          ELSE COALESCE(conv.channel, conv.received_channel_id)
        END
        WHERE m.type IN ('image', 'document', 'audio', 'video', 'sticker')
        AND (m.media_path IS NULL OR m.media_path = '')
        AND c.type IN ('evolution', 'meta_api', 'whatsapp')
        ORDER BY m.created_at DESC
        LIMIT ${limit}
      `;

      return rows.map((row) => ({
        id: row.id as string,
        type: row.type as string,
        mimetype: row.mimetype as string | null,
        content: row.content as string | null,
        remoteJid: row.remote_jid as string | null,
        channelId: row.channel_id as string,
        channelType: row.channel_type as string,
        channelPayload: row.channel_payload as Record<string, unknown>,
      }));
    } catch (error) {
      this.logger.error("Error finding messages needing recovery:", error);
      return [];
    }
  }
}
