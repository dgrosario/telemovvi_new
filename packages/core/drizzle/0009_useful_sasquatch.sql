CREATE TABLE "flows_in_sectors" (
	"flow_id" uuid NOT NULL,
	"sector_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flows_in_sectors" ADD CONSTRAINT "flows_in_sectors_flow_id_flows_id_fk" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "flows_in_sectors" ADD CONSTRAINT "flows_in_sectors_sector_id_sectors_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sectors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_flow_in_sector" ON "flows_in_sectors" USING btree ("flow_id","sector_id");