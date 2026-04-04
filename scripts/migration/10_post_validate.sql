-- v1 → v2 Migration: Post-migration validation
-- Run after all migration scripts to verify data integrity.

\echo '==============================================='
\echo '  POST-MIGRATION VALIDATION'
\echo '==============================================='

\echo ''
\echo '=== 1. Record count comparison ==='
SELECT
    t.table_name,
    t.v1_count,
    t.v2_count,
    CASE
        WHEN t.v1_count = t.v2_count THEN 'OK'
        WHEN t.v2_count > 0 AND t.v1_count > t.v2_count THEN 'PARTIAL (expected for filtered tables)'
        WHEN t.v2_count = 0 AND t.v1_count > 0 THEN 'MISSING'
        ELSE 'CHECK'
    END AS status
FROM (
    SELECT 'users' AS table_name, (SELECT COUNT(*) FROM v1.users) AS v1_count, (SELECT COUNT(*) FROM users) AS v2_count
    UNION ALL SELECT 'municipalities', (SELECT COUNT(*) FROM v1.municipalities), (SELECT COUNT(*) FROM municipalities)
    UNION ALL SELECT 'locations', (SELECT COUNT(*) FROM v1.locations), (SELECT COUNT(*) FROM locations)
    UNION ALL SELECT 'places', (SELECT COUNT(*) FROM v1.places), (SELECT COUNT(*) FROM places)
    UNION ALL SELECT 'threads', (SELECT COUNT(*) FROM v1.threads), (SELECT COUNT(*) FROM threads)
    UNION ALL SELECT 'comments', (SELECT COUNT(*) FROM v1.comments), (SELECT COUNT(*) FROM comments)
    UNION ALL SELECT 'thread_votes', (SELECT COUNT(*) FROM v1.thread_votes), (SELECT COUNT(*) FROM thread_votes)
    UNION ALL SELECT 'comment_votes', (SELECT COUNT(*) FROM v1.comment_votes), (SELECT COUNT(*) FROM comment_votes)
    UNION ALL SELECT 'bookmarks', (SELECT COUNT(*) FROM v1.bookmarks), (SELECT COUNT(*) FROM bookmarks)
    UNION ALL SELECT 'notifications', (SELECT COUNT(*) FROM v1.notifications), (SELECT COUNT(*) FROM notifications)
    UNION ALL SELECT 'user_sanctions', (SELECT COUNT(*) FROM v1.user_sanctions), (SELECT COUNT(*) FROM user_sanctions)
    UNION ALL SELECT 'conversations', (SELECT COUNT(*) FROM v1.conversations), (SELECT COUNT(*) FROM conversations)
    UNION ALL SELECT 'messages (from DMs)', (SELECT COUNT(*) FROM v1.direct_messages), (SELECT COUNT(*) FROM messages)
    UNION ALL SELECT 'subscriptions', (SELECT COUNT(*) FROM v1.user_subscriptions), (SELECT COUNT(*) FROM user_subscriptions)
) t
ORDER BY t.table_name;

\echo ''
\echo '=== 2. FK integrity checks ==='

-- Threads reference existing users
SELECT 'threads.author_id → users' AS "check",
       COUNT(*) AS orphaned
FROM threads t
LEFT JOIN users u ON t.author_id = u.id
WHERE u.id IS NULL;

-- Comments reference existing threads
SELECT 'comments.thread_id → threads' AS "check",
       COUNT(*) AS orphaned
FROM comments c
LEFT JOIN threads t ON c.thread_id = t.id
WHERE t.id IS NULL;

-- Comments reference existing users
SELECT 'comments.author_id → users' AS "check",
       COUNT(*) AS orphaned
FROM comments c
LEFT JOIN users u ON c.author_id = u.id
WHERE u.id IS NULL;

-- Memberships reference existing conversations
SELECT 'memberships.conversation_id → conversations' AS "check",
       COUNT(*) AS orphaned
FROM memberships m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE c.id IS NULL;

-- Messages reference existing conversations
SELECT 'messages.conversation_id → conversations' AS "check",
       COUNT(*) AS orphaned
FROM messages m
LEFT JOIN conversations c ON m.conversation_id = c.id
WHERE c.id IS NULL;

\echo ''
\echo '=== 3. Enum value validation ==='

-- User roles
SELECT 'user roles' AS "check", role, COUNT(*)
FROM users
GROUP BY role
ORDER BY 3 DESC;

-- Conversation types
SELECT 'conversation types' AS "check", type, encryption, COUNT(*)
FROM conversations
GROUP BY type, encryption;

-- Sanction types
SELECT 'sanction types' AS "check", sanction_type, COUNT(*)
FROM user_sanctions
GROUP BY sanction_type;

\echo ''
\echo '=== 4. FTN identity preservation ==='
SELECT
    (SELECT COUNT(*) FROM v1.users WHERE rp_subject IS NOT NULL) AS v1_ftn_users,
    (SELECT COUNT(*) FROM users WHERE rp_subject IS NOT NULL) AS v2_ftn_users,
    CASE
        WHEN (SELECT COUNT(*) FROM v1.users WHERE rp_subject IS NOT NULL) =
             (SELECT COUNT(*) FROM users WHERE rp_subject IS NOT NULL)
        THEN 'OK — all FTN users preserved'
        ELSE 'MISMATCH — check migration'
    END AS status;

\echo ''
\echo '=== 5. Data samples ==='

-- Newest migrated thread
SELECT 'newest thread' AS "sample", id, title, author_id, created_at
FROM threads ORDER BY created_at DESC LIMIT 1;

-- Newest migrated conversation
SELECT 'newest conversation' AS "sample", id, type, encryption, created_at
FROM conversations ORDER BY created_at DESC LIMIT 1;

\echo ''
\echo '==============================================='
\echo '  VALIDATION COMPLETE'
\echo '  Zero orphaned FK rows = migration is clean'
\echo '==============================================='
