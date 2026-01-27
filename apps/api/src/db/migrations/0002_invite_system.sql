-- Migration: Invite System
-- Adds invite codes table and invite-related fields to users

-- Create invite code status enum
DO $$ BEGIN
    CREATE TYPE invite_code_status AS ENUM ('available', 'used', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id),
  used_by UUID REFERENCES users(id),
  status invite_code_status DEFAULT 'available',
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes(code);
CREATE INDEX IF NOT EXISTS invite_codes_created_by_idx ON invite_codes(created_by);
CREATE INDEX IF NOT EXISTS invite_codes_status_idx ON invite_codes(status);

-- Add invite-related fields to users
ALTER TABLE users
ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS invite_codes_remaining INTEGER DEFAULT 5;

CREATE INDEX IF NOT EXISTS users_invited_by_idx ON users(invited_by);

-- Make email optional (username is now the primary identifier)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Make username required
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
