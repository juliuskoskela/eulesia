-- v1 → v2 Migration: Moderation data
-- Reports, actions, sanctions, appeals.
-- Filter out club/room content_type values (no v2 equivalent).

BEGIN;

\echo '=== Migrating content reports ==='
INSERT INTO content_reports (
    id, reporter_id, content_type, content_id, reason, description,
    status, assigned_to, resolved_at, created_at
)
SELECT
    id, reporter_id,
    -- Map v1 content_type: keep thread/comment/user, skip club/room types
    content_type::text, content_id,
    reason::text, description,
    COALESCE(status::text, 'pending'), assigned_to, resolved_at, created_at
FROM v1.content_reports
WHERE content_type NOT IN ('club_thread', 'club_comment', 'club', 'room_message')
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating moderation actions ==='
INSERT INTO moderation_actions (
    id, admin_id, action_type, target_type, target_id,
    report_id, reason, metadata, created_at
)
SELECT
    id, admin_id, action_type::text, target_type::text, target_id,
    report_id, reason, metadata, created_at
FROM v1.moderation_actions
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating user sanctions ==='
INSERT INTO user_sanctions (
    id, user_id, sanction_type, reason, issued_by,
    issued_at, expires_at, revoked_at, revoked_by
)
SELECT
    id, user_id, sanction_type::text, reason, issued_by,
    issued_at, expires_at, revoked_at, revoked_by
FROM v1.user_sanctions
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating moderation appeals ==='
INSERT INTO moderation_appeals (
    id, user_id, sanction_id, report_id, action_id,
    reason, status, admin_response, responded_by, responded_at, created_at
)
SELECT
    id, user_id, sanction_id, report_id, action_id,
    reason, COALESCE(status::text, 'pending'),
    admin_response, responded_by, responded_at, created_at
FROM v1.moderation_appeals
ON CONFLICT (id) DO NOTHING;

COMMIT;

\echo '=== Moderation migration complete ==='
SELECT 'content_reports' AS "table",
       (SELECT COUNT(*) FROM v1.content_reports) AS v1_total,
       (SELECT COUNT(*) FROM v1.content_reports WHERE content_type IN ('club_thread','club_comment','club','room_message')) AS v1_skipped,
       COUNT(*) AS v2
FROM content_reports
UNION ALL SELECT 'user_sanctions',
       (SELECT COUNT(*) FROM v1.user_sanctions), 0, COUNT(*) FROM user_sanctions
UNION ALL SELECT 'moderation_appeals',
       (SELECT COUNT(*) FROM v1.moderation_appeals), 0, COUNT(*) FROM moderation_appeals;
