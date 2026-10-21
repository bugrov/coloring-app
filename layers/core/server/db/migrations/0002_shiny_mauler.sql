CREATE TABLE "arts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" bigint GENERATED ALWAYS AS IDENTITY (sequence name "arts_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"builtin_key" text,
	"owner_id" uuid,
	"title" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arts_seq_unique" UNIQUE("seq"),
	CONSTRAINT "arts_builtin_key_unique" UNIQUE("builtin_key")
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"art_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"percent" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_user_art_attempt_unique" UNIQUE("user_id","art_id","attempt")
);
--> statement-breakpoint
ALTER TABLE "arts" ADD CONSTRAINT "arts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_art_id_arts_id_fk" FOREIGN KEY ("art_id") REFERENCES "public"."arts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arts_owner_id_idx" ON "arts" USING btree ("owner_id");