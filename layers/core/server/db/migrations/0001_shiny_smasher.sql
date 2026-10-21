ALTER TABLE "users" DROP CONSTRAINT "users_username_key_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_key_country_unique" UNIQUE("username_key","country");