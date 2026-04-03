-- Eulesia v2 initial schema
-- Uses UUIDv7 for all primary keys (time-sortable)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- User accounts (identity, not crypto keys)
CREATE TABLE IF NOT EXISTS users (
    id          uuid PRIMARY KEY,
    username    varchar(50) NOT NULL UNIQUE,
    email       varchar(255) UNIQUE,
    name        varchar(255) NOT NULL,
    avatar_url  varchar(500),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Devices (one user, many devices — each with its own key material)
CREATE TABLE IF NOT EXISTS devices (
    id              uuid PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name    varchar(255),
    identity_key    bytea NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices (user_id);

-- Sessions (auth sessions bound to a device)
CREATE TABLE IF NOT EXISTS sessions (
    id          uuid PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id   uuid REFERENCES devices(id) ON DELETE SET NULL,
    token_hash  varchar(255) NOT NULL,
    expires_at  timestamptz NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions (token_hash);
