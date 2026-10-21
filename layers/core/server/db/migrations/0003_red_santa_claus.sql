CREATE TABLE "history_steps" (
	"progress_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"ops" jsonb NOT NULL,
	CONSTRAINT "history_steps_progress_id_seq_pk" PRIMARY KEY("progress_id","seq")
);
--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "cursor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "step_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "rev" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "thumbnail_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "history_steps" ADD CONSTRAINT "history_steps_progress_id_progress_id_fk" FOREIGN KEY ("progress_id") REFERENCES "public"."progress"("id") ON DELETE cascade ON UPDATE no action;