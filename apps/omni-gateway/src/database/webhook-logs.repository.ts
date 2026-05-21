import { Injectable, Logger } from "@nestjs/common";
import mongoose, { Schema } from "mongoose";
import { MongoDBService } from "./mongodb.service";

const webhookLogSchema = new Schema(
  {
    channelType: {
      type: String,
      required: true,
      enum: ["whatsapp", "instagram", "evolution"],
    },
    payload: { type: Schema.Types.Mixed, required: true },
    phoneNumberId: { type: String, default: null },
    error: { type: String, default: null },
    processed: { type: Boolean, default: true },
    processingTimeMs: { type: Number, default: null },
  },
  {
    timestamps: true,
    collection: "webhook_logs",
  }
);

webhookLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);
webhookLogSchema.index({ channelType: 1, createdAt: -1 });
webhookLogSchema.index({ phoneNumberId: 1 }, { sparse: true });

@Injectable()
export class WebhookLogsRepository {
  private readonly logger = new Logger(WebhookLogsRepository.name);
  private model: mongoose.Model<any> | null = null;

  constructor(private readonly mongoDBService: MongoDBService) {}

  private getModel(): mongoose.Model<any> | null {
    if (this.model) return this.model;
    if (!this.mongoDBService.isConnected()) return null;

    this.model =
      mongoose.models.WebhookLog ||
      mongoose.model("WebhookLog", webhookLogSchema);
    return this.model;
  }

  async save(data: {
    channelType: "whatsapp" | "instagram" | "evolution";
    payload: Record<string, unknown>;
    phoneNumberId?: string;
  }): Promise<string | null> {
    const model = this.getModel();
    if (!model) return null;

    try {
      const doc = await model.create(data);
      return doc.id;
    } catch (error) {
      this.logger.error("Failed to save webhook log", error);
      return null;
    }
  }

  async markProcessed(id: string, processingTimeMs: number): Promise<void> {
    const model = this.getModel();
    if (!model || !id) return;

    try {
      await model.updateOne(
        { _id: id },
        { processed: true, processingTimeMs }
      );
    } catch (error) {
      this.logger.error(`Failed to update webhook log: ${id}`, error);
    }
  }

  async markFailed(id: string, errorMsg: string): Promise<void> {
    const model = this.getModel();
    if (!model || !id) return;

    try {
      await model.updateOne(
        { _id: id },
        { processed: false, error: errorMsg }
      );
    } catch (error) {
      this.logger.error(`Failed to update webhook log: ${id}`, error);
    }
  }
}
