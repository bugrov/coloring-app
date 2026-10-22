CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "art_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"art_id" uuid NOT NULL,
	"country" char(2),
	"user_id" uuid,
	CONSTRAINT "art_assignments_one_target" CHECK (("art_assignments"."country" is null) <> ("art_assignments"."user_id" is null))
);
--> statement-breakpoint
CREATE TABLE "art_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid NOT NULL,
	"art_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"country" char(2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arts" ADD COLUMN "status" text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE "art_assignments" ADD CONSTRAINT "art_assignments_art_id_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "art_assignments" ADD CONSTRAINT "art_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "art_events" ADD CONSTRAINT "art_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "art_events" ADD CONSTRAINT "art_events_art_id_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "art_assignments_country_unique" ON "art_assignments" USING btree ("art_id","country") WHERE "art_assignments"."country" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "art_assignments_user_unique" ON "art_assignments" USING btree ("art_id","user_id") WHERE "art_assignments"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "art_events_art_type_time_idx" ON "art_events" USING btree ("art_id","type","created_at");--> statement-breakpoint
CREATE INDEX "art_events_time_idx" ON "art_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "art_events_once_per_attempt" ON "art_events" USING btree ("user_id","art_id","attempt","type") WHERE "art_events"."type" in ('start', 'complete');