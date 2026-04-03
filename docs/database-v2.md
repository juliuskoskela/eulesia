# Eulesia v2 Database Schema

## Design Principles

1. **UUIDv7 everywhere** — all primary keys are time-sortable UUIDs
2. **Server-blind for E2EE** — encrypted content is `bytea` (opaque), never inspected
3. **Append-only events** — membership changes, message delivery tracked as events
4. **Audit columns** — `created_at`, `updated_at` on all mutable tables
5. **Foreign keys enforced** — at the database level, not application
6. **Soft deletes** — `deleted_at` timestamp, never hard delete user-facing data
7. **sqlx** — compile-time checked queries in Rust, raw SQL migrations

## Schema Overview

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   users      │──┬──│  devices     │     │  conversations   │
│              │  │  │  (keys)     │     │  (1:1, group,    │
│  identity    │  │  └─────────────┘     │   channel)       │
│  profile     │  │                      └────────┬─────────┘
│  settings    │  │  ┌─────────────┐              │
└──────┬───────┘  ├──│  sessions   │     ┌────────┴─────────┐
       │          │  └─────────────┘     │  memberships     │
       │          │                      │  (role, epoch)   │
       │          │  ┌─────────────┐     └────────┬─────────┘
       │          └──│  pre_keys   │              │
       │             └─────────────┘     ┌────────┴─────────┐
       │                                 │  messages        │
       │          ┌─────────────┐        │  (encrypted      │
       ├──────────│  follows     │        │   envelopes)     │
       │          │  blocks      │        └──────────────────┘
       │          │  mutes       │
       │          └─────────────┘        ┌──────────────────┐
       │                                 │  media           │
       │          ┌─────────────┐        │  (encrypted      │
       └──────────│  threads     │        │   attachments)   │
                  │  comments    │        └──────────────────┘
                  │  votes       │
                  └─────────────┘
```

## Domain 1: Identity

### users

Core identity. Carries over from v1 with additions for device-based auth.

```sql
CREATE TABLE users (
    id              uuid PRIMARY KEY,       -- UUIDv7
    username        varchar(50) NOT NULL UNIQUE,
    email           varchar(255) UNIQUE,
    password_hash   varchar(255),
    name            varchar(255) NOT NULL,
    avatar_url      varchar(500),
    bio             text,

    -- Role & institution
    role            varchar(20) NOT NULL DEFAULT 'citizen',
    institution_type varchar(50),
    institution_name varchar(255),

    -- Identity verification (FTN / EUDI)
    identity_verified    boolean NOT NULL DEFAULT false,
    identity_provider    varchar(50),
    identity_level       varchar(20) NOT NULL DEFAULT 'basic',
    verified_name        varchar(255),

    -- Location
    municipality_id uuid REFERENCES municipalities(id),

    -- Settings
    locale          varchar(10) NOT NULL DEFAULT 'en',

    -- Lifecycle
    deleted_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz
);
```

**GDPR PII columns**: `email`, `name`, `avatar_url`, `bio`, `verified_name`, `password_hash`

### devices

One user, many devices. Each device has its own crypto identity.

```sql
CREATE TABLE devices (
    id              uuid PRIMARY KEY,       -- UUIDv7
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name    varchar(255),
    platform        varchar(20),            -- web, android, ios

    -- Public crypto keys (server never holds private keys)
    identity_key    bytea NOT NULL,         -- long-lived device identity
    signed_pre_key  bytea NOT NULL,         -- rotatable signed pre-key
    signed_pre_key_sig bytea NOT NULL,      -- signature over signed pre-key

    -- Lifecycle
    last_seen_at    timestamptz,
    revoked_at      timestamptz,            -- null = active, set = revoked
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_devices_user_id ON devices (user_id);
CREATE INDEX idx_devices_active ON devices (user_id) WHERE revoked_at IS NULL;
```

### one_time_pre_keys

Consumable pre-keys for session establishment (X3DH).

```sql
CREATE TABLE one_time_pre_keys (
    id              uuid PRIMARY KEY,
    device_id       uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    key_data        bytea NOT NULL,
    uploaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_otpk_device ON one_time_pre_keys (device_id);
```

### sessions

Auth sessions bound to a device.

```sql
CREATE TABLE sessions (
    id              uuid PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       uuid REFERENCES devices(id) ON DELETE SET NULL,
    token_hash      varchar(255) NOT NULL,
    ip_address      inet,
    user_agent      text,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_token ON sessions (token_hash);
CREATE INDEX idx_sessions_user ON sessions (user_id);
```

## Domain 2: Conversations & Messaging (E2EE)

### conversations

Container for all conversation types. Server tracks metadata only.

```sql
CREATE TYPE conversation_type AS ENUM ('direct', 'group', 'channel');

CREATE TABLE conversations (
    id              uuid PRIMARY KEY,
    type            conversation_type NOT NULL,
    name            varchar(255),           -- null for 1:1
    description     text,                   -- group/channel description
    avatar_url      varchar(500),
    creator_id      uuid REFERENCES users(id),
    is_public       boolean NOT NULL DEFAULT false,

    -- Epoch tracking for group key rotation
    current_epoch   bigint NOT NULL DEFAULT 0,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### memberships

User-conversation join table with role and epoch. Append-only for audit.

```sql
CREATE TYPE membership_role AS ENUM ('member', 'moderator', 'admin', 'owner');

CREATE TABLE memberships (
    id              uuid PRIMARY KEY,
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            membership_role NOT NULL DEFAULT 'member',

    -- Epoch this membership was established in
    joined_epoch    bigint NOT NULL,

    -- Lifecycle
    left_at         timestamptz,            -- null = active member
    removed_by      uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),

    UNIQUE (conversation_id, user_id) WHERE left_at IS NULL
);

CREATE INDEX idx_memberships_conv ON memberships (conversation_id) WHERE left_at IS NULL;
CREATE INDEX idx_memberships_user ON memberships (user_id) WHERE left_at IS NULL;
```

### messages

Encrypted message envelopes. Server stores opaque blobs.

```sql
CREATE TABLE messages (
    id              uuid PRIMARY KEY,       -- UUIDv7 (time-sortable)
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       uuid NOT NULL REFERENCES users(id),
    sender_device_id uuid NOT NULL REFERENCES devices(id),

    -- Epoch this message was sent in (for key lookup)
    epoch           bigint NOT NULL,

    -- Encrypted content — server cannot read this
    ciphertext      bytea NOT NULL,

    -- Message type hint (server uses for routing, not content inspection)
    message_type    varchar(20) NOT NULL DEFAULT 'text',

    -- Delivery metadata (server-visible)
    server_ts       timestamptz NOT NULL DEFAULT now(),

    -- Soft delete
    deleted_at      timestamptz
);

CREATE INDEX idx_messages_conv_ts ON messages (conversation_id, server_ts);
CREATE INDEX idx_messages_sender ON messages (sender_id);
```

### message_recipients

Per-device encrypted copies for multi-device fan-out.

```sql
CREATE TABLE message_recipients (
    message_id      uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    device_id       uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    ciphertext      bytea NOT NULL,         -- encrypted for this specific device
    delivered_at    timestamptz,
    PRIMARY KEY (message_id, device_id)
);

CREATE INDEX idx_msg_recv_device ON message_recipients (device_id) WHERE delivered_at IS NULL;
```

### media

Encrypted attachment metadata. Actual blobs in object storage.

```sql
CREATE TABLE media (
    id              uuid PRIMARY KEY,
    uploader_id     uuid NOT NULL REFERENCES users(id),
    conversation_id uuid REFERENCES conversations(id),

    -- Encrypted file metadata
    file_name       varchar(255),
    content_type    varchar(100),
    size_bytes      bigint NOT NULL,

    -- Storage reference
    storage_key     varchar(500) NOT NULL,

    -- Encryption key is in the message, not here (server-blind)
    created_at      timestamptz NOT NULL DEFAULT now()
);
```

## Domain 3: Social Graph

### follows

Asymmetric follow relationship.

```sql
CREATE TABLE follows (
    follower_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id)
);

CREATE INDEX idx_follows_followed ON follows (followed_id);
```

### blocks

Bidirectional block. Both users lose access to each other.

```sql
CREATE TABLE blocks (
    blocker_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);
```

### mutes

Unilateral mute. Target doesn't know.

```sql
CREATE TABLE mutes (
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muted_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, muted_id)
);
```

## Domain 4: Events (Outbox)

Append-only event log for async processing and audit.

```sql
CREATE TABLE events (
    id              uuid PRIMARY KEY,       -- UUIDv7
    event_type      varchar(100) NOT NULL,
    aggregate_type  varchar(50) NOT NULL,   -- user, conversation, message, etc.
    aggregate_id    uuid NOT NULL,
    payload         jsonb NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    processed_at    timestamptz             -- null = pending
);

CREATE INDEX idx_events_pending ON events (created_at) WHERE processed_at IS NULL;
CREATE INDEX idx_events_aggregate ON events (aggregate_type, aggregate_id, created_at);
```

**Event types**: `user.created`, `device.registered`, `device.revoked`, `conversation.created`, `member.joined`, `member.left`, `member.role_changed`, `message.sent`, `message.delivered`, `epoch.rotated`

## Migration Strategy

### What carries over from v1

The v2 Rust server runs on a **separate database** (`eulesia_v2`). No shared tables with v1.

Data migration happens as a one-time script after v2 is stable:

| v1 Table                                | v2 Treatment                                                |
| --------------------------------------- | ----------------------------------------------------------- |
| `users`                                 | Migrate core fields. No password migration (users re-auth). |
| `municipalities`, `locations`, `places` | Copy as-is to v2 DB.                                        |
| `threads`, `comments`, `votes`          | Copy as-is (public content).                                |
| `clubs`, `club_*`                       | Copy as-is.                                                 |
| `conversations`, `direct_messages`      | **Do not migrate.** E2EE starts fresh.                      |
| `content_reports`, `moderation_*`       | Copy for compliance continuity.                             |
| `sessions`, `invite_codes`, `waitlist`  | Do not migrate (ephemeral).                                 |

### Migration phases

1. **v2 empty schema** — deploy migrations, no data
2. **v2 identity** — users can register/login on v2
3. **v2 messaging** — E2EE conversations start fresh
4. **v1 data import** — batch-copy public content, geo data, moderation history
5. **v1 sunset** — redirect all traffic to v2

## Query Conventions (sqlx)

### Why sqlx

- Compile-time checked SQL against the actual database schema
- No ORM abstraction layer — write real SQL
- Async with tokio, native PostgreSQL support
- Migrations embedded in the binary

### Patterns

```rust
// Simple query with compile-time checking
let user = sqlx::query_as!(
    User,
    "SELECT id, username, name, avatar_url FROM users WHERE id = $1",
    user_id
)
.fetch_optional(&pool)
.await?;

// Insert returning
let device = sqlx::query_as!(
    Device,
    r#"INSERT INTO devices (id, user_id, display_name, platform, identity_key, signed_pre_key, signed_pre_key_sig)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id, display_name, platform, created_at"#,
    new_id(), user_id, name, platform, identity_key, signed_pre_key, sig
)
.fetch_one(&pool)
.await?;

// Transaction
let mut tx = pool.begin().await?;
sqlx::query!("INSERT INTO memberships (...) VALUES (...)", ...).execute(&mut *tx).await?;
sqlx::query!("UPDATE conversations SET current_epoch = $1 WHERE id = $2", epoch, conv_id).execute(&mut *tx).await?;
tx.commit().await?;
```

### Transaction boundaries

- **Single entity writes**: no transaction needed (single INSERT/UPDATE)
- **Multi-entity writes**: always wrap in a transaction
- **Membership changes + epoch rotation**: always transactional
- **Message send + recipient fan-out**: always transactional

## Indexing Strategy

| Table                | Hot queries               | Indexes                                   |
| -------------------- | ------------------------- | ----------------------------------------- |
| `users`              | Login by username/email   | `username` (unique), `email` (unique)     |
| `devices`            | Active devices for user   | `(user_id) WHERE revoked_at IS NULL`      |
| `sessions`           | Token lookup              | `token_hash`                              |
| `conversations`      | User's conversations      | Via `memberships` index                   |
| `memberships`        | Active members of conv    | `(conversation_id) WHERE left_at IS NULL` |
| `messages`           | Latest messages in conv   | `(conversation_id, server_ts)`            |
| `message_recipients` | Undelivered for device    | `(device_id) WHERE delivered_at IS NULL`  |
| `events`             | Pending events            | `(created_at) WHERE processed_at IS NULL` |
| `follows`            | Who follows me            | `(followed_id)`                           |
| `blocks`             | Am I blocked by this user | `(blocked_id)`                            |

## Future: Partitioning

Not implemented in the initial schema. When `messages` exceeds ~100M rows, partition by `server_ts` (monthly ranges). The `(conversation_id, server_ts)` index works well with range partitioning.
