CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"type" text DEFAULT 'whatsapp' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels_in_sectors" (
	"channel_id" uuid,
	"sector_id" uuid
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel" uuid,
	"sector_id" uuid,
	"contact" uuid,
	"attendant_id" uuid,
	"status" varchar(10) NOT NULL,
	"workspace_id" uuid NOT NULL,
	"active_flow_execution_id" uuid,
	"opened_at" timestamp,
	"closed_at" timestamp,
	"received_channel_id" uuid,
	"conversation_type" varchar(20) DEFAULT 'external' NOT NULL,
	"name" varchar(255),
	"group_jid" varchar(50)
);
--> statement-breakpoint
CREATE TABLE "flow_execution_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"execution_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error_message" text,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flow_executions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"flow_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"current_node_id" text,
	"status" text DEFAULT 'running' NOT NULL,
	"variables" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"failed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"connections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows_in_channels" (
	"flow_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "internal_conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"permissions" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"original_content" text,
	"caption" text,
	"filename" text,
	"mimetype" text,
	"media_key" text,
	"media_path" varchar(500),
	"created_at" integer NOT NULL,
	"viewed_at" integer,
	"deleted_at" integer,
	"edited_at" integer,
	"type" varchar(15),
	"status" text DEFAULT 'senting' NOT NULL,
	"sender_type" varchar(10),
	"sender_name" text DEFAULT '' NOT NULL,
	"sender_id" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	"conversation_id" uuid,
	"quoted_message_id" text
);
--> statement-breakpoint
CREATE TABLE "meta_app_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_type" varchar(20) NOT NULL,
	"app_id" varchar(100) NOT NULL,
	"app_secret" text NOT NULL,
	"config_id" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meta_app_settings_channel_type_unique" UNIQUE("channel_type")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recipient_type" varchar(20) NOT NULL,
	"recipient_id" uuid NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp,
	"priority" varchar(10) DEFAULT 'normal' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "partner_contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'whatsapp' NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"thumbnail" text DEFAULT '',
	"partner_id" uuid NOT NULL,
	"channel_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_contacts_value_unique" UNIQUE("value")
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"tags" text[] DEFAULT '{}',
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners_metadata" (
	"label" text DEFAULT '' NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"partner_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_messages" (
	"message_id" varchar(128) PRIMARY KEY NOT NULL,
	"instance_name" varchar(255) NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quick_messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"shortcode" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"media_url" text,
	"media_type" varchar(20),
	"media_name" varchar(255),
	"is_public" boolean DEFAULT false NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "response_channels" (
	"received_id" uuid NOT NULL,
	"response_id" uuid NOT NULL,
	CONSTRAINT "response_channels_received_id_response_id_pk" PRIMARY KEY("received_id","response_id")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sectors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"workspace_id" uuid,
	"removed" boolean DEFAULT false NOT NULL,
	"working_hours_start" time DEFAULT '08:00:00' NOT NULL,
	"working_hours_end" time DEFAULT '19:00:00' NOT NULL,
	"color" varchar(7) DEFAULT '#3B82F6' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_variables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" varchar(255) NOT NULL,
	"description" text,
	"resolver_type" varchar(50) NOT NULL,
	"resolver_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"workspace_id" uuid,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"language" varchar(10) NOT NULL,
	"category" text NOT NULL,
	"text" text NOT NULL,
	"channel_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notification_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"realtime_enabled" boolean DEFAULT true NOT NULL,
	"show_floating_button" boolean DEFAULT true NOT NULL,
	"show_all_conversations" boolean DEFAULT false NOT NULL,
	"enabled_types" text[] DEFAULT '{"conversation:assigned","internal:message","transfer:requested","channel:new-message"}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"thumbnail" text DEFAULT '',
	"password" text DEFAULT '' NOT NULL,
	"is_deletable" boolean DEFAULT true NOT NULL,
	"signature_enabled" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users_in_sectors" (
	"user_id" uuid,
	"sector_id" uuid
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "channels_in_sectors" ADD CONSTRAINT "channels_in_sectors_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "channels_in_sectors" ADD CONSTRAINT "channels_in_sectors_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_channels_id_fk" FOREIGN KEY ("channel") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_partner_contacts_id_fk" FOREIGN KEY ("contact") REFERENCES "public"."partner_contacts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_attendant_id_users_id_fk" FOREIGN KEY ("attendant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_received_channel_id_channels_id_fk" FOREIGN KEY ("received_channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flow_execution_logs" ADD CONSTRAINT "flow_execution_logs_execution_id_flow_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."flow_executions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flows_in_channels" ADD CONSTRAINT "flows_in_channels_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flows_in_channels" ADD CONSTRAINT "flows_in_channels_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "internal_conversation_participants" ADD CONSTRAINT "internal_conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "internal_conversation_participants" ADD CONSTRAINT "internal_conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partner_contacts" ADD CONSTRAINT "partner_contacts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partners" ADD CONSTRAINT "partners_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partners_metadata" ADD CONSTRAINT "partners_metadata_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "response_channels" ADD CONSTRAINT "response_channels_received_id_channels_id_fk" FOREIGN KEY ("received_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "response_channels" ADD CONSTRAINT "response_channels_response_id_channels_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sectors" ADD CONSTRAINT "sectors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "system_variables" ADD CONSTRAINT "system_variables_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notification_settings" ADD CONSTRAINT "user_notification_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users_in_sectors" ADD CONSTRAINT "users_in_sectors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users_in_sectors" ADD CONSTRAINT "users_in_sectors_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_channels_workspace_id" ON "channels" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_channel_in_sector" ON "channels_in_sectors" USING btree ("channel_id","sector_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_workspace_id" ON "conversations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_status" ON "conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_conversations_workspace_status" ON "conversations" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "idx_conversations_attendant_id" ON "conversations" USING btree ("attendant_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_type" ON "conversations" USING btree ("conversation_type");--> statement-breakpoint
CREATE INDEX "idx_conversations_group_jid" ON "conversations" USING btree ("group_jid");--> statement-breakpoint
CREATE INDEX "idx_conversations_sector_id" ON "conversations" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_workspace_sector" ON "conversations" USING btree ("workspace_id","sector_id");--> statement-breakpoint
CREATE INDEX "idx_flow_executions_conversation_id" ON "flow_executions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_flow_executions_status" ON "flow_executions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_flows_workspace_id" ON "flows" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_flows_status" ON "flows" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_flow_in_channel" ON "flows_in_channels" USING btree ("flow_id","channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_participant" ON "internal_conversation_participants" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_participants_conversation" ON "internal_conversation_participants" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_participants_user" ON "internal_conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_memberships_user_id" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_memberships_workspace_id" ON "memberships" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_meta_app_settings_channel_type" ON "meta_app_settings" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "idx_meta_app_settings_is_active" ON "meta_app_settings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_notifications_workspace_id" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_type","recipient_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_is_read" ON "notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_notifications_created_at" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_type" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_unread" ON "notifications" USING btree ("recipient_type","recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_partner_contacts_partner_id" ON "partner_contacts" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_partner_contacts_channel_id" ON "partner_contacts" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_partners_workspace_id" ON "partners" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "idx_partners_created_at" ON "partners" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_partner_metadata" ON "partners_metadata" USING btree ("label","value","partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_shortcode_per_user_workspace" ON "quick_messages" USING btree ("shortcode","user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_roles_workspace_id" ON "roles" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_role_name_per_workspace" ON "roles" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "idx_sectors_workspace_id" ON "sectors" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_variable_key_per_workspace" ON "system_variables" USING btree ("key","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_templates_channel_id" ON "templates" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_notification_settings" ON "user_notification_settings" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "idx_user_notification_settings_user_id" ON "user_notification_settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_in_sector" ON "users_in_sectors" USING btree ("user_id","sector_id");