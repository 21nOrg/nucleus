ALTER TABLE "sessionLog" DROP CONSTRAINT "sessionLog___ns_session_id_session___ns_id_fk";
--> statement-breakpoint
ALTER TABLE "session_items" DROP CONSTRAINT "session_items___ns_session_id_session___ns_id_fk";
--> statement-breakpoint
ALTER TABLE "capture" ALTER COLUMN "children_with_structure" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "capture" ALTER COLUMN "method" SET DEFAULT 'MARKDOWN';--> statement-breakpoint
ALTER TABLE "capture" ALTER COLUMN "refresh_id" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "capture" ALTER COLUMN "root_structure" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "publicLink" ADD COLUMN "resource_region" text;--> statement-breakpoint
ALTER TABLE "sessionLog" ADD CONSTRAINT "sessionLog___ns_session_id_session___ns_id_fk" FOREIGN KEY ("__ns","session_id") REFERENCES "public"."session"("__ns","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_items" ADD CONSTRAINT "session_items___ns_session_id_session___ns_id_fk" FOREIGN KEY ("__ns","session_id") REFERENCES "public"."session"("__ns","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publicLink_resource_region_idx" ON "publicLink" USING btree ("resource_region");