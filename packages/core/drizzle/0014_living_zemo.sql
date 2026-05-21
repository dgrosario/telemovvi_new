CREATE TABLE "partners_labels" (
	"partner_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partners_labels_partner_id_label_id_pk" PRIMARY KEY("partner_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "partners_labels" ADD CONSTRAINT "partners_labels_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "partners_labels" ADD CONSTRAINT "partners_labels_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_partners_labels_partner_id" ON "partners_labels" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_partners_labels_label_id" ON "partners_labels" USING btree ("label_id");