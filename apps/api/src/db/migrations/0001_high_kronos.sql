CREATE TYPE "public"."action_type" AS ENUM('content_removed', 'content_restored', 'user_warned', 'user_suspended', 'user_banned', 'user_unbanned', 'report_dismissed', 'report_resolved', 'role_changed', 'user_verified', 'user_unverified', 'settings_changed', 'invite_count_changed');--> statement-breakpoint
CREATE TYPE "public"."announcement_type" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."appeal_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('thread', 'comment', 'club_thread', 'club_comment', 'club', 'user', 'room_message', 'dm', 'system');--> statement-breakpoint
CREATE TYPE "public"."institution_claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."institution_manager_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "public"."location_type" AS ENUM('country', 'region', 'municipality', 'village', 'district');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('illegal', 'harassment', 'spam', 'misinformation', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."sanction_type" AS ENUM('warning', 'suspension', 'ban');--> statement-breakpoint
CREATE TYPE "public"."subscription_notify" AS ENUM('all', 'none', 'highlights');--> statement-breakpoint
CREATE TYPE "public"."thread_source" AS ENUM('user', 'minutes_import', 'rss_import');--> statement-breakpoint
ALTER TYPE "public"."institution_type" ADD VALUE 'organization';--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bookmarks_user_id_thread_id_pk" PRIMARY KEY("user_id","thread_id")
);
--> statement-breakpoint
CREATE TABLE "club_comment_votes" (
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "club_comment_votes_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "club_thread_votes" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "club_thread_votes_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "content_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'pending',
	"assigned_to" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now(),
	"is_muted" boolean DEFAULT false,
	"joined_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "conversation_participants_conversation_id_user_id_pk" PRIMARY KEY("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_html" text,
	"is_hidden" boolean DEFAULT false,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "edit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"edited_by" uuid NOT NULL,
	"previous_content" text NOT NULL,
	"previous_content_html" text,
	"previous_title" varchar(500),
	"edited_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "institution_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "institution_manager_role" DEFAULT 'editor' NOT NULL,
	"status" "institution_claim_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"approved_at" timestamp with time zone,
	"approved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "institution_topics" (
	"institution_id" uuid PRIMARY KEY NOT NULL,
	"topic_tag" varchar(100) NOT NULL,
	"related_tags" varchar(100)[] DEFAULT '{}',
	"description" text
);
--> statement-breakpoint
CREATE TABLE "link_previews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"site_name" text,
	"favicon_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"error" boolean DEFAULT false,
	CONSTRAINT "link_previews_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"osm_id" integer,
	"osm_type" varchar(20) DEFAULT 'relation',
	"name" varchar(255) NOT NULL,
	"name_local" varchar(255),
	"name_fi" varchar(255),
	"name_sv" varchar(255),
	"name_en" varchar(255),
	"admin_level" integer,
	"type" varchar(50),
	"parent_id" uuid,
	"country" varchar(2) DEFAULT 'FI',
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"bounds" jsonb,
	"population" integer,
	"status" varchar(20) DEFAULT 'active',
	"content_count" integer DEFAULT 0,
	"nominatim_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "locations_osm_id_unique" UNIQUE("osm_id")
);
--> statement-breakpoint
CREATE TABLE "message_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action_type" "action_type" NOT NULL,
	"target_type" "content_type" NOT NULL,
	"target_id" uuid NOT NULL,
	"report_id" uuid,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moderation_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sanction_id" uuid,
	"report_id" uuid,
	"action_id" uuid,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "appeal_status" DEFAULT 'pending',
	"admin_response" text,
	"responded_by" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" "announcement_type" DEFAULT 'info' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tag_categories" (
	"tag" varchar(100) PRIMARY KEY NOT NULL,
	"category" varchar(100) NOT NULL,
	"display_name" varchar(255),
	"description" text,
	"scope" "scope",
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "thread_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid,
	"session_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "thread_votes" (
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "thread_votes_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "trending_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"score" numeric(12, 4) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"computed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sanctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"sanction_type" "sanction_type" NOT NULL,
	"reason" text,
	"issued_by" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid
);
--> statement-breakpoint
ALTER TABLE "tag_categories" ALTER COLUMN "scope" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "scope" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."scope";--> statement-breakpoint
CREATE TYPE "public"."scope" AS ENUM('local', 'national', 'european');--> statement-breakpoint
ALTER TABLE "tag_categories" ALTER COLUMN "scope" SET DATA TYPE "public"."scope" USING "scope"::"public"."scope";--> statement-breakpoint
ALTER TABLE "threads" ALTER COLUMN "scope" SET DATA TYPE "public"."scope" USING "scope"::"public"."scope";--> statement-breakpoint
ALTER TABLE "club_comments" ADD COLUMN "score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "club_comments" ADD COLUMN "is_hidden" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "club_comments" ADD COLUMN "language" varchar(10);--> statement-breakpoint
ALTER TABLE "club_threads" ADD COLUMN "score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "club_threads" ADD COLUMN "is_hidden" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "club_threads" ADD COLUMN "language" varchar(10);--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "cover_image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "is_hidden" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_by" uuid;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "language" varchar(10);--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "room_messages" ADD COLUMN "is_hidden" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "room_messages" ADD COLUMN "edited_by" uuid;--> statement-breakpoint
ALTER TABLE "room_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "country" varchar(2) DEFAULT 'FI';--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "view_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "source" "thread_source" DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "source_url" varchar(1000);--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "source_id" varchar(255);--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "source_institution_id" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_generated" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "ai_model" varchar(100);--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "original_content" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "edited_by" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "is_hidden" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "language" varchar(10);--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD COLUMN "notify" varchar(20) DEFAULT 'all';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_id" varchar(50);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_id_country" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "website_url" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified_name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rp_subject" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_issuer" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "identity_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_comment_votes" ADD CONSTRAINT "club_comment_votes_comment_id_club_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."club_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_comment_votes" ADD CONSTRAINT "club_comment_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_thread_votes" ADD CONSTRAINT "club_thread_votes_thread_id_club_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."club_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_thread_votes" ADD CONSTRAINT "club_thread_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edit_history" ADD CONSTRAINT "edit_history_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_managers" ADD CONSTRAINT "institution_managers_institution_id_users_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_managers" ADD CONSTRAINT "institution_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_managers" ADD CONSTRAINT "institution_managers_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_topics" ADD CONSTRAINT "institution_topics_institution_id_users_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_message_id_room_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."room_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_content_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."content_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_sanction_id_user_sanctions_id_fk" FOREIGN KEY ("sanction_id") REFERENCES "public"."user_sanctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_report_id_content_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."content_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_action_id_moderation_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."moderation_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_appeals" ADD CONSTRAINT "moderation_appeals_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_announcements" ADD CONSTRAINT "system_announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_views" ADD CONSTRAINT "thread_views_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_views" ADD CONSTRAINT "thread_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_votes" ADD CONSTRAINT "thread_votes_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thread_votes" ADD CONSTRAINT "thread_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookmarks_user_idx" ON "bookmarks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "club_comment_votes_comment_idx" ON "club_comment_votes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "club_thread_votes_thread_idx" ON "club_thread_votes" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "content_reports_status_idx" ON "content_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_reports_content_idx" ON "content_reports" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "content_reports_reporter_idx" ON "content_reports" USING btree ("reporter_user_id");--> statement-breakpoint
CREATE INDEX "conv_participants_user_idx" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_updated_idx" ON "conversations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "dm_conversation_idx" ON "direct_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "edit_history_content_idx" ON "edit_history" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "edit_history_edited_by_idx" ON "edit_history" USING btree ("edited_by");--> statement-breakpoint
CREATE INDEX "edit_history_edited_at_idx" ON "edit_history" USING btree ("edited_at");--> statement-breakpoint
CREATE INDEX "institution_managers_institution_idx" ON "institution_managers" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX "institution_managers_user_idx" ON "institution_managers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "institution_managers_unique_idx" ON "institution_managers" USING btree ("institution_id","user_id");--> statement-breakpoint
CREATE INDEX "institution_topics_topic_tag_idx" ON "institution_topics" USING btree ("topic_tag");--> statement-breakpoint
CREATE INDEX "locations_parent_idx" ON "locations" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "locations_admin_level_idx" ON "locations" USING btree ("admin_level");--> statement-breakpoint
CREATE INDEX "locations_osm_idx" ON "locations" USING btree ("osm_id");--> statement-breakpoint
CREATE INDEX "locations_country_idx" ON "locations" USING btree ("country");--> statement-breakpoint
CREATE INDEX "locations_coords_idx" ON "locations" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "locations_status_idx" ON "locations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "locations_content_count_idx" ON "locations" USING btree ("content_count");--> statement-breakpoint
CREATE INDEX "message_reactions_message_idx" ON "message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_reactions_unique_idx" ON "message_reactions" USING btree ("message_id","user_id","emoji");--> statement-breakpoint
CREATE INDEX "moderation_actions_admin_idx" ON "moderation_actions" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "moderation_actions_created_idx" ON "moderation_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_appeals_user_idx" ON "moderation_appeals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "moderation_appeals_status_idx" ON "moderation_appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "tag_categories_category_idx" ON "tag_categories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tag_categories_sort_idx" ON "tag_categories" USING btree ("category","sort_order");--> statement-breakpoint
CREATE INDEX "thread_views_thread_idx" ON "thread_views" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "thread_views_created_idx" ON "thread_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "thread_views_user_thread_idx" ON "thread_views" USING btree ("thread_id","user_id");--> statement-breakpoint
CREATE INDEX "thread_votes_thread_idx" ON "thread_votes" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "trending_cache_type_score_idx" ON "trending_cache" USING btree ("entity_type","score");--> statement-breakpoint
CREATE UNIQUE INDEX "trending_cache_unique_idx" ON "trending_cache" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "user_sanctions_user_idx" ON "user_sanctions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sanctions_active_idx" ON "user_sanctions" USING btree ("user_id","sanction_type","revoked_at");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_source_institution_id_users_id_fk" FOREIGN KEY ("source_institution_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_threads_language_idx" ON "club_threads" USING btree ("language");--> statement-breakpoint
CREATE INDEX "places_location_idx" ON "places" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "threads_score_idx" ON "threads" USING btree ("score");--> statement-breakpoint
CREATE INDEX "threads_location_idx" ON "threads" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "threads_source_idx" ON "threads" USING btree ("source");--> statement-breakpoint
CREATE INDEX "threads_source_id_idx" ON "threads" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "threads_source_institution_idx" ON "threads" USING btree ("source_institution_id");--> statement-breakpoint
CREATE INDEX "threads_language_idx" ON "threads" USING btree ("language");--> statement-breakpoint
CREATE INDEX "user_subscriptions_entity_idx" ON "user_subscriptions" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");