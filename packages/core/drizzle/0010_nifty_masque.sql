ALTER TABLE "campaigns" ADD COLUMN "type" varchar(20) DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "min_interval_ms" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "max_interval_ms" integer DEFAULT 30000 NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "birthday" date;--> statement-breakpoint
CREATE INDEX "idx_campaigns_type" ON "campaigns" USING btree ("type");