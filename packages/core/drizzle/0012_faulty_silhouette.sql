CREATE TABLE "sector_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sector_id" uuid NOT NULL,
	"permission" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "processed_messages" ALTER COLUMN "message_id" SET DATA TYPE varchar(256);--> statement-breakpoint
ALTER TABLE "sector_permissions" ADD CONSTRAINT "sector_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "sector_permissions" ADD CONSTRAINT "sector_permissions_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_sector_permissions_user_id" ON "sector_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sector_permissions_sector_id" ON "sector_permissions" USING btree ("sector_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_sector_permission" ON "sector_permissions" USING btree ("user_id","sector_id","permission");