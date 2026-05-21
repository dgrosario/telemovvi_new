CREATE TABLE "campaign_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"variation_label" varchar(1) NOT NULL,
	"type" varchar(15) DEFAULT 'text' NOT NULL,
	"content" text,
	"template_name" varchar(255),
	"variables" jsonb DEFAULT '[]'::jsonb,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"campaign_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"partner_contact_id" uuid NOT NULL,
	"message_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"external_message_id" text,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"filter_tags" text[] DEFAULT '{}',
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_by" uuid,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_partner_contact_id_partner_contacts_id_fk" FOREIGN KEY ("partner_contact_id") REFERENCES "public"."partner_contacts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_message_id_campaign_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."campaign_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_campaign_messages_campaign_id" ON "campaign_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_campaign_variation" ON "campaign_messages" USING btree ("campaign_id","variation_label");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipients_campaign_id" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipients_status" ON "campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipients_partner_contact_id" ON "campaign_recipients" USING btree ("partner_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_campaign_recipient" ON "campaign_recipients" USING btree ("campaign_id","partner_contact_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_workspace_id" ON "campaigns" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_campaigns_status" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_scheduled_at" ON "campaigns" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "idx_campaigns_created_at" ON "campaigns" USING btree ("created_at");