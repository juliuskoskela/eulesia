-- v1 → v2 Migration: DMs → plaintext conversations
--
-- v1 model: conversations + conversation_participants + direct_messages (plaintext)
-- v2 model: conversations (encryption='none') + direct_conversations + memberships + messages
--
-- This is the most complex migration script. It:
-- 1. Creates v2 conversations from v1 conversations
-- 2. Creates direct_conversations index for 1:1 chats
-- 3. Creates memberships from v1 conversation_participants
-- 4. Migrates messages: v1 plaintext content → v2 ciphertext column (as UTF-8 bytes)
-- 5. Creates message_redactions for hidden messages

BEGIN;

\echo '=== Migrating conversations ==='
-- v1 conversations are bare containers (id, created_at, updated_at)
-- v2 conversations have type, encryption, etc.
INSERT INTO conversations (
    id, type, encryption, name, description, avatar_url,
    creator_id, is_public, current_epoch, deleted_at, created_at, updated_at
)
SELECT
    c.id,
    'direct',           -- all v1 conversations are direct messages
    'none',             -- plaintext (migrated from v1)
    NULL,               -- DMs have no name
    NULL,               -- no description
    NULL,               -- no avatar
    NULL,               -- no explicit creator
    false,              -- DMs are private
    0,                  -- epoch 0 (no key rotation for plaintext)
    NULL,               -- not deleted
    c.created_at,
    c.updated_at
FROM v1.conversations c
ON CONFLICT (id) DO NOTHING;

\echo '=== Creating direct_conversations index ==='
-- Map v1 2-participant conversations to the v2 direct_conversations table.
-- The pair (user_a, user_b) is ordered so user_a < user_b.
INSERT INTO direct_conversations (conversation_id, user_a_id, user_b_id)
SELECT
    cp1.conversation_id,
    LEAST(cp1.user_id, cp2.user_id),
    GREATEST(cp1.user_id, cp2.user_id)
FROM v1.conversation_participants cp1
JOIN v1.conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
    AND cp1.user_id < cp2.user_id
ON CONFLICT (conversation_id) DO NOTHING;

\echo '=== Migrating memberships ==='
INSERT INTO memberships (
    id, conversation_id, user_id, role, joined_epoch,
    left_at, removed_by, created_at
)
SELECT
    gen_random_uuid(),
    conversation_id,
    user_id,
    'member',
    0,                  -- epoch 0 for all migrated members
    NULL,               -- not left
    NULL,               -- not removed
    COALESCE(joined_at, NOW())
FROM v1.conversation_participants
ON CONFLICT DO NOTHING;

\echo '=== Migrating messages ==='
-- v1 direct_messages.content (text) → v2 messages.ciphertext (bytea, UTF-8 encoded)
-- sender_device_id is NULL for plaintext messages
INSERT INTO messages (
    id, conversation_id, sender_id, sender_device_id, epoch,
    ciphertext, message_type, server_ts
)
SELECT
    dm.id,
    dm.conversation_id,
    dm.author_id,       -- v1 author_id → v2 sender_id
    NULL,               -- no device binding for plaintext
    0,                  -- epoch 0
    convert_to(dm.content, 'UTF8'),  -- store plaintext as bytes
    'text',             -- all v1 DMs are text
    dm.created_at       -- server_ts = created_at
FROM v1.direct_messages dm
WHERE dm.is_hidden = false
ON CONFLICT (id) DO NOTHING;

\echo '=== Creating redactions for hidden messages ==='
-- v1 soft-deleted messages (is_hidden=true) → v2 message_redactions
-- First insert the message shell, then the redaction.
INSERT INTO messages (
    id, conversation_id, sender_id, sender_device_id, epoch,
    ciphertext, message_type, server_ts
)
SELECT
    dm.id,
    dm.conversation_id,
    dm.author_id,
    NULL,
    0,
    NULL,               -- no content for redacted messages
    'text',
    dm.created_at
FROM v1.direct_messages dm
WHERE dm.is_hidden = true
ON CONFLICT (id) DO NOTHING;

INSERT INTO message_redactions (message_id, redacted_by, reason, created_at)
SELECT
    dm.id,
    dm.author_id,
    'migrated_hidden',
    COALESCE(dm.updated_at, dm.created_at)
FROM v1.direct_messages dm
WHERE dm.is_hidden = true
ON CONFLICT (message_id) DO NOTHING;

COMMIT;

\echo '=== Conversation migration complete ==='
SELECT 'conversations' AS "table", (SELECT COUNT(*) FROM v1.conversations) AS v1, COUNT(*) AS v2 FROM conversations
UNION ALL SELECT 'direct_conversations', 0, COUNT(*) FROM direct_conversations
UNION ALL SELECT 'memberships', (SELECT COUNT(*) FROM v1.conversation_participants), COUNT(*) FROM memberships
UNION ALL SELECT 'messages (visible)', (SELECT COUNT(*) FROM v1.direct_messages WHERE is_hidden = false), (SELECT COUNT(*) FROM messages WHERE ciphertext IS NOT NULL)
UNION ALL SELECT 'messages (redacted)', (SELECT COUNT(*) FROM v1.direct_messages WHERE is_hidden = true), (SELECT COUNT(*) FROM message_redactions);
