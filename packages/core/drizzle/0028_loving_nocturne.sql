CREATE TABLE "inbound_message_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"instance_name" varchar(255) NOT NULL,
	"message_id" varchar(500),
	"event" varchar(100) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_inbound_message_logs_source_created" ON "inbound_message_logs" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "idx_inbound_message_logs_message_id" ON "inbound_message_logs" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_inbound_message_logs_created_at" ON "inbound_message_logs" USING btree ("created_at");