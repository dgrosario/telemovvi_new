import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import mongoose, { Connection } from "mongoose";

@Injectable()
export class MongoDBService implements OnModuleDestroy {
  private readonly logger = new Logger(MongoDBService.name);
  private connection: Connection | null = null;

  constructor() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      this.logger.warn(
        "MONGODB_URI not configured - webhook logging disabled"
      );
      return;
    }

    mongoose
      .connect(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 })
      .then(() => {
        this.connection = mongoose.connection;
        this.logger.log("MongoDB connection established");
      })
      .catch((error) => {
        this.logger.warn(
          `MongoDB connection failed - webhook logging disabled: ${error.message}`
        );
        this.connection = null;
      });
  }

  getConnection(): Connection | null {
    return this.connection;
  }

  isConnected(): boolean {
    return this.connection?.readyState === 1;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.logger.log("MongoDB connection closed");
    }
  }
}
