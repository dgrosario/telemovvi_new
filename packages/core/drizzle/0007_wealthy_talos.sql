DROP INDEX "unique_partner_metadata";--> statement-breakpoint
CREATE UNIQUE INDEX "unique_partner_metadata" ON "partners_metadata" USING btree ("partner_id","label");