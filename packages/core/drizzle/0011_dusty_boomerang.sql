CREATE TABLE "calculator_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"installment_number" integer NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calculator_settings" ADD CONSTRAINT "calculator_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_calculator_settings_workspace_id" ON "calculator_settings" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_calculator_settings_workspace_installment" ON "calculator_settings" USING btree ("workspace_id","installment_number");