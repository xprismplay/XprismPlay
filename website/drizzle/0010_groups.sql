CREATE TABLE IF NOT EXISTS "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" varchar(500),
	"icon" text,
	"owner_id" integer,
	"is_public" boolean DEFAULT true NOT NULL,
	"treasury_balance" numeric(30, 8) DEFAULT '0.00000000' NOT NULL,
	"member_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "group_member" (
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_member_pk" PRIMARY KEY("group_id","user_id")
);

CREATE TABLE IF NOT EXISTS "group_join_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_join_request_unique" UNIQUE("group_id","user_id")
);

CREATE TABLE IF NOT EXISTS "group_wall_post" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer,
	"content" varchar(500) NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "group_treasury_tx" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer,
	"type" varchar(20) NOT NULL,
	"amount" numeric(30, 8) NOT NULL,
	"note" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
	ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_join_request" ADD CONSTRAINT "group_join_request_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_join_request" ADD CONSTRAINT "group_join_request_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_wall_post" ADD CONSTRAINT "group_wall_post_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_wall_post" ADD CONSTRAINT "group_wall_post_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_treasury_tx" ADD CONSTRAINT "group_treasury_tx_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
	ALTER TABLE "group_treasury_tx" ADD CONSTRAINT "group_treasury_tx_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "groups_owner_id_idx" ON "groups" ("owner_id");
CREATE INDEX IF NOT EXISTS "groups_name_idx" ON "groups" ("name");
CREATE INDEX IF NOT EXISTS "group_member_group_id_idx" ON "group_member" ("group_id");
CREATE INDEX IF NOT EXISTS "group_member_user_id_idx" ON "group_member" ("user_id");
CREATE INDEX IF NOT EXISTS "group_join_request_group_id_idx" ON "group_join_request" ("group_id");
CREATE INDEX IF NOT EXISTS "group_wall_post_group_id_idx" ON "group_wall_post" ("group_id");
CREATE INDEX IF NOT EXISTS "group_treasury_tx_group_id_idx" ON "group_treasury_tx" ("group_id");