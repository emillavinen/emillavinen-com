CREATE TABLE "alerts" (
	"key" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"first_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"display_url" text NOT NULL,
	"thumb_url" text NOT NULL,
	"social_url" text NOT NULL,
	"bsky_url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"status" text NOT NULL,
	"not_before" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"skip_reason" text,
	"text" text,
	"remote_id" text,
	"remote_url" text,
	"claimed_at" timestamp with time zone,
	"posted_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"platform" text,
	"work_id" uuid,
	"message" text DEFAULT '' NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
CREATE TABLE "feed_items" (
	"pin_id" text PRIMARY KEY NOT NULL,
	"board_url" text NOT NULL,
	"is_baseline" boolean NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image_url" text NOT NULL,
	"link" text NOT NULL,
	"board_title" text,
	"pub_date" timestamp with time zone,
	"first_seen_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"work_id" uuid,
	"last_error" text
);
--> statement-breakpoint
CREATE TABLE "pinterest_boards" (
	"url" text PRIMARY KEY NOT NULL,
	"title" text,
	"baselined_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_state" (
	"platform" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'disabled' NOT NULL,
	"credentials" text,
	"account" text,
	"token_expires_at" timestamp with time zone,
	"token_refreshed_at" timestamp with time zone,
	"last_ok_at" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"note" text,
	"lock_until" timestamp with time zone,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"client" text,
	"tools" text[] DEFAULT '{}' NOT NULL,
	"year" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"origin" text NOT NULL,
	"source_id" text,
	"source_url" text,
	"media_type" text DEFAULT 'image' NOT NULL,
	"visible_on_site" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"queued_at" timestamp with time zone,
	"summary_claimed_at" timestamp with time zone,
	"summary_sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_work_position_key" ON "assets" USING btree ("work_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "deliveries_work_platform_key" ON "deliveries" USING btree ("work_id","platform");--> statement-breakpoint
CREATE INDEX "deliveries_status_not_before_idx" ON "deliveries" USING btree ("status","not_before");--> statement-breakpoint
CREATE INDEX "events_at_idx" ON "events" USING btree ("at");--> statement-breakpoint
CREATE INDEX "events_type_at_idx" ON "events" USING btree ("type","at");--> statement-breakpoint
CREATE INDEX "feed_items_processed_idx" ON "feed_items" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "works_slug_key" ON "works" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "works_origin_source_key" ON "works" USING btree ("origin","source_id");--> statement-breakpoint
CREATE INDEX "works_created_at_idx" ON "works" USING btree ("created_at");