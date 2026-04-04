-- v1 → v2 Migration: Pre-flight checks
-- Run against the v2 database with v1 schema available as "v1."

\echo '=== v1 Record Counts ==='

SELECT 'users' AS "table", COUNT(*) FROM v1.users
UNION ALL SELECT 'municipalities', COUNT(*) FROM v1.municipalities
UNION ALL SELECT 'locations', COUNT(*) FROM v1.locations
UNION ALL SELECT 'places', COUNT(*) FROM v1.places
UNION ALL SELECT 'threads', COUNT(*) FROM v1.threads
UNION ALL SELECT 'comments', COUNT(*) FROM v1.comments
UNION ALL SELECT 'thread_votes', COUNT(*) FROM v1.thread_votes
UNION ALL SELECT 'comment_votes', COUNT(*) FROM v1.comment_votes
UNION ALL SELECT 'thread_tags', COUNT(*) FROM v1.thread_tags
UNION ALL SELECT 'thread_views', COUNT(*) FROM v1.thread_views
UNION ALL SELECT 'bookmarks', COUNT(*) FROM v1.bookmarks
UNION ALL SELECT 'notifications', COUNT(*) FROM v1.notifications
UNION ALL SELECT 'push_subscriptions', COUNT(*) FROM v1.push_subscriptions
UNION ALL SELECT 'content_reports', COUNT(*) FROM v1.content_reports
UNION ALL SELECT 'moderation_actions', COUNT(*) FROM v1.moderation_actions
UNION ALL SELECT 'user_sanctions', COUNT(*) FROM v1.user_sanctions
UNION ALL SELECT 'moderation_appeals', COUNT(*) FROM v1.moderation_appeals
UNION ALL SELECT 'conversations', COUNT(*) FROM v1.conversations
UNION ALL SELECT 'direct_messages', COUNT(*) FROM v1.direct_messages
UNION ALL SELECT 'user_subscriptions', COUNT(*) FROM v1.user_subscriptions
ORDER BY 1;

\echo '=== v1 Users by Role ==='
SELECT role, COUNT(*) FROM v1.users GROUP BY role ORDER BY role;

\echo '=== v1 Identity Providers ==='
SELECT identity_provider, COUNT(*) FROM v1.users GROUP BY identity_provider ORDER BY 2 DESC;

\echo '=== v1 Users with FTN (rp_subject set) ==='
SELECT COUNT(*) AS ftn_users FROM v1.users WHERE rp_subject IS NOT NULL;

\echo '=== v2 Target Tables (should be empty) ==='
SELECT 'users' AS "table", COUNT(*) FROM users
UNION ALL SELECT 'threads', COUNT(*) FROM threads
UNION ALL SELECT 'conversations', COUNT(*) FROM conversations
ORDER BY 1;
