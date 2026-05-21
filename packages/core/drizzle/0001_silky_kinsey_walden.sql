CREATE TABLE "starred_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"starred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "starred_messages" ADD CONSTRAINT "starred_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starred_messages" ADD CONSTRAINT "starred_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "starred_messages" ADD CONSTRAINT "starred_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_starred_message" ON "starred_messages" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE INDEX "idx_starred_messages_user_id" ON "starred_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_starred_messages_conversation_id" ON "starred_messages" USING btree ("conversation_id");