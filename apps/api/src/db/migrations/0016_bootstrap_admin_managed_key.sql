ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managed_by" varchar(50);

CREATE INDEX IF NOT EXISTS "users_managed_by_idx" ON "users" ("managed_by");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managed_key" varchar(100);

CREATE UNIQUE INDEX IF NOT EXISTS "users_managed_key_unique_idx" ON "users" ("managed_by", "managed_key");
