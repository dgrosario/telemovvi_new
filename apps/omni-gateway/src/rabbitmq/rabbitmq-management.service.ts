import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

interface ParsedAmqpUri {
  managementUrl: string;
  credentials: string;
  vhost: string;
}

interface CleanupResult {
  deleted: string[];
  errors: string[];
}

@Injectable()
export class RabbitMQManagementService {
  private readonly logger = new Logger(RabbitMQManagementService.name);
  private readonly managementUrl: string;
  private readonly credentials: string;
  private readonly vhost: string;

  private readonly instanceQueueSuffixes = [
    "connection.update",
    "contacts.upsert",
    "contacts.update",
    "contacts.set",
    "messages.upsert",
    "messages.update",
    "messages.delete",
    "messages.set",
    "messages.edited",
    "presence.update",
    "qrcode.updated",
    "send.message",
    "chats.upsert",
    "chats.update",
    "chats.delete",
    "chats.set",
    "groups.upsert",
    "group.update",
    "group.participants.update",
    "call",
    "typebot.start",
    "typebot.change.status",
  ];

  constructor(private readonly configService: ConfigService) {
    const managementUrlFromEnv = this.configService.get<string>(
      "evolutionRabbitmq.managementUrl"
    );
    const amqpUri =
      this.configService.get<string>("evolutionRabbitmq.url") ?? "";

    if (managementUrlFromEnv) {
      this.managementUrl = managementUrlFromEnv;
      const parsed = this.parseAmqpUri(amqpUri);
      this.credentials = parsed.credentials;
      this.vhost = parsed.vhost;
    } else {
      const parsed = this.parseAmqpUri(amqpUri);
      this.managementUrl = parsed.managementUrl;
      this.credentials = parsed.credentials;
      this.vhost = parsed.vhost;
    }

    if (this.managementUrl) {
      this.logger.log(
        `RabbitMQ Management configured: ${this.managementUrl}, vhost: ${this.vhost}`
      );
    } else {
      this.logger.warn(
        "RabbitMQ Management URL not configured - queue cleanup will be disabled"
      );
    }
  }

  private parseAmqpUri(uri: string): ParsedAmqpUri {
    if (!uri) {
      return { managementUrl: "", credentials: "", vhost: "%2F" };
    }

    const match = uri.match(
      /amqp:\/\/([^:]+):([^@]+)@([^:]+):(\d+)(?:\/(.*))?/
    );
    if (!match) {
      this.logger.warn(`Could not parse AMQP URI: ${uri}`);
      return { managementUrl: "", credentials: "", vhost: "%2F" };
    }

    const [, user, pass, host] = match;
    const vhost = match[5] ? encodeURIComponent(match[5]) : "%2F";

    return {
      managementUrl: `https://${host}:15672`,
      credentials: Buffer.from(`${user}:${pass}`).toString("base64"),
      vhost,
    };
  }

  async deleteInstanceQueues(instanceName: string): Promise<CleanupResult> {
    const deleted: string[] = [];
    const errors: string[] = [];

    if (!this.managementUrl) {
      this.logger.warn(
        `Skipping queue cleanup for ${instanceName}: Management URL not configured`
      );
      return { deleted, errors: ["Management URL not configured"] };
    }

    this.logger.log(`Starting queue cleanup for instance: ${instanceName}`);

    for (const suffix of this.instanceQueueSuffixes) {
      const queueName = `${instanceName}.${suffix}`;
      try {
        const success = await this.deleteQueue(queueName);
        if (success) {
          deleted.push(queueName);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`${queueName}: ${msg}`);
        this.logger.error(`Error deleting queue ${queueName}: ${msg}`);
      }
    }

    this.logger.log(
      `Instance ${instanceName} cleanup complete: ${deleted.length} queues deleted, ${errors.length} errors`
    );

    return { deleted, errors };
  }

  private async deleteQueue(queueName: string): Promise<boolean> {
    const encodedQueue = encodeURIComponent(queueName);
    const url = `${this.managementUrl}/api/queues/${this.vhost}/${encodedQueue}`;

    try {
      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${this.credentials}`,
        },
      });

      if (response.status === 204 || response.status === 200) {
        this.logger.debug(`Deleted queue: ${queueName}`);
        return true;
      }

      if (response.status === 404) {
        this.logger.debug(`Queue not found (already deleted): ${queueName}`);
        return false;
      }

      const errorText = await response.text().catch(() => "");
      this.logger.warn(
        `Failed to delete queue ${queueName}: HTTP ${response.status} - ${errorText}`
      );
      return false;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Network error deleting queue ${queueName}: ${msg}`);
      throw error;
    }
  }

  async listInstanceQueues(instanceName: string): Promise<string[]> {
    if (!this.managementUrl) {
      return [];
    }

    const url = `${this.managementUrl}/api/queues/${this.vhost}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${this.credentials}`,
        },
      });

      if (!response.ok) {
        this.logger.warn(`Failed to list queues: HTTP ${response.status}`);
        return [];
      }

      const queues = (await response.json()) as Array<{ name: string }>;
      return queues
        .filter((q) => q.name.startsWith(`${instanceName}.`))
        .map((q) => q.name);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error listing queues: ${msg}`);
      return [];
    }
  }
}
