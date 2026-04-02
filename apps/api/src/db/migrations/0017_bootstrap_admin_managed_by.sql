ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "managed_by" varchar(50);

CREATE INDEX IF NOT EXISTS "users_managed_by_idx" ON "users" ("managed_by");
