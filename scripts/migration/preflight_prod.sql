-- Prod preflight: check for row shapes that would cause migration failures.
-- Run against the PROD v1 database BEFORE migrating.
-- Each query should return 0 for safe migration.

\echo '=== PROD PREFLIGHT CHECKS ==='
\echo ''

-- 1. Notifications with type='dm' — these map to event_type in v2.
--    If present, need to verify the v2 notifications table accepts 'dm' as event_type.
\echo '1. Notifications with type=dm'
SELECT COUNT(*) AS dm_notifications FROM notifications WHERE type = 'dm';

-- 2. Hidden direct messages — these create message_redactions.
--    Check if any exist and whether their authors still exist.
\echo '2. Hidden DMs (need redaction rows)'
SELECT COUNT(*) AS hidden_dms FROM direct_messages WHERE is_hidden = true;
SELECT COUNT(*) AS hidden_dms_orphaned_author
FROM direct_messages dm
LEFT JOIN users u ON dm.author_id = u.id
WHERE dm.is_hidden = true AND u.id IS NULL;

-- 3. Moderation actions with admin_user_id that might not exist in users table.
--    v2 moderation_actions.admin_id has FK to users.
\echo '3. Moderation actions with missing admin users'
SELECT COUNT(*) AS orphaned_mod_actions
FROM moderation_actions ma
LEFT JOIN users u ON ma.admin_user_id = u.id
WHERE u.id IS NULL;

-- 4. Moderation actions tied to club/room content types (skipped in migration).
\echo '4. Moderation actions for skipped content types'
SELECT action_type::text, COUNT(*)
FROM moderation_actions
WHERE target_type::text IN ('club_thread', 'club_comment', 'club', 'room_message')
GROUP BY action_type::text;

-- 5. Content reports with club/room types (skipped in migration).
--    Check if any sanctions or appeals reference these reports.
\echo '5. Reports for skipped content types + downstream refs'
SELECT COUNT(*) AS skipped_reports
FROM content_reports
WHERE content_type::text IN ('club_thread', 'club_comment', 'club', 'room_message');

SELECT COUNT(*) AS appeals_referencing_skipped_reports
FROM moderation_appeals ma
JOIN content_reports cr ON ma.report_id = cr.id
WHERE cr.content_type::text IN ('club_thread', 'club_comment', 'club', 'room_message');

-- 6. Thread scopes — check for any unexpected values.
\echo '6. Thread scopes'
SELECT scope::text, COUNT(*) FROM threads GROUP BY scope::text ORDER BY 2 DESC;

-- 7. Anonymous thread_views (user_id IS NULL) — v2 has NOT NULL on user_id.
\echo '7. Thread views with NULL user_id'
SELECT COUNT(*) AS null_user_views FROM thread_views WHERE user_id IS NULL;

-- 8. Users with role='admin' — mapped to 'moderator' in v2.
\echo '8. Users with admin role (will become moderator)'
SELECT COUNT(*) AS admin_users FROM users WHERE role::text = 'admin';

-- 9. Threads/comments referencing deleted users.
\echo '9. Orphaned content (author deleted)'
SELECT COUNT(*) AS orphaned_threads
FROM threads t LEFT JOIN users u ON t.author_id = u.id WHERE u.id IS NULL;
SELECT COUNT(*) AS orphaned_comments
FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE u.id IS NULL;

-- 10. Conversations with >2 participants (shouldn't exist for DMs but check).
\echo '10. Conversations with unexpected participant count'
SELECT cp.conversation_id, COUNT(*) AS participant_count
FROM conversation_participants cp
GROUP BY cp.conversation_id
HAVING COUNT(*) != 2;

-- 11. Users with duplicate rp_subject (would violate UNIQUE in v2).
\echo '11. Duplicate rp_subject values'
SELECT rp_subject, COUNT(*) FROM users
WHERE rp_subject IS NOT NULL
GROUP BY rp_subject HAVING COUNT(*) > 1;

-- 12. Total record counts for reference.
\echo ''
\echo '=== RECORD COUNTS ==='
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'threads', COUNT(*) FROM threads
UNION ALL SELECT 'comments', COUNT(*) FROM comments
UNION ALL SELECT 'thread_votes', COUNT(*) FROM thread_votes
UNION ALL SELECT 'comment_votes', COUNT(*) FROM comment_votes
UNION ALL SELECT 'thread_tags', COUNT(*) FROM thread_tags
UNION ALL SELECT 'bookmarks', COUNT(*) FROM bookmarks
UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL SELECT 'direct_messages', COUNT(*) FROM direct_messages
UNION ALL SELECT 'content_reports', COUNT(*) FROM content_reports
UNION ALL SELECT 'moderation_actions', COUNT(*) FROM moderation_actions
UNION ALL SELECT 'user_sanctions', COUNT(*) FROM user_sanctions
UNION ALL SELECT 'moderation_appeals', COUNT(*) FROM moderation_appeals
UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM push_subscriptions
ORDER BY 1;

\echo ''
\echo '=== PREFLIGHT COMPLETE ==='
\echo 'All counts should be 0 for checks 1-11 (except 6 which shows distributions).'
\echo 'Non-zero values need handling in run_migration.sh before prod migration.'
