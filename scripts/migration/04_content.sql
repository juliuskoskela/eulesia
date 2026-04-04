-- v1 → v2 Migration: Public content
-- Threads, comments, votes, tags, bookmarks, views.
-- 95% compatible — archive editedBy/editedAt from threads and comments.

BEGIN;

\echo '=== Migrating threads ==='
INSERT INTO threads (
    id, title, content, content_html, author_id, scope, country,
    municipality_id, location_id, place_id, latitude, longitude,
    institutional_context, is_pinned, is_locked, reply_count, score,
    view_count, source, source_url, source_id, source_institution_id,
    ai_generated, ai_model, language, is_hidden, deleted_at,
    created_at, updated_at
)
SELECT
    id, title, content, content_html, author_id, scope::text, country,
    municipality_id, location_id, place_id, latitude, longitude,
    institutional_context, COALESCE(is_pinned, false), COALESCE(is_locked, false),
    COALESCE(reply_count, 0), COALESCE(score, 0), COALESCE(view_count, 0),
    source::text, source_url, source_id, source_institution_id,
    COALESCE(ai_generated, false), ai_model, language, COALESCE(is_hidden, false),
    deleted_at, created_at, updated_at
FROM v1.threads
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating comments ==='
INSERT INTO comments (
    id, thread_id, parent_id, author_id, content, content_html,
    depth, score, language, is_hidden, deleted_at, created_at, updated_at
)
SELECT
    id, thread_id, parent_id, author_id, content, content_html,
    COALESCE(depth, 0), COALESCE(score, 0), language,
    COALESCE(is_hidden, false), deleted_at, created_at, updated_at
FROM v1.comments
ON CONFLICT (id) DO NOTHING;

\echo '=== Migrating thread votes ==='
INSERT INTO thread_votes (thread_id, user_id, value, created_at)
SELECT thread_id, user_id, value::smallint, created_at
FROM v1.thread_votes
ON CONFLICT (thread_id, user_id) DO NOTHING;

\echo '=== Migrating comment votes ==='
INSERT INTO comment_votes (comment_id, user_id, value, created_at)
SELECT comment_id, user_id, value::smallint, created_at
FROM v1.comment_votes
ON CONFLICT (comment_id, user_id) DO NOTHING;

\echo '=== Migrating thread tags ==='
INSERT INTO thread_tags (thread_id, tag)
SELECT thread_id, tag
FROM v1.thread_tags
ON CONFLICT (thread_id, tag) DO NOTHING;

\echo '=== Migrating bookmarks ==='
INSERT INTO bookmarks (user_id, thread_id, created_at)
SELECT user_id, thread_id, created_at
FROM v1.bookmarks
ON CONFLICT (user_id, thread_id) DO NOTHING;

\echo '=== Migrating thread views ==='
INSERT INTO thread_views (thread_id, user_id, viewed_at)
SELECT thread_id, user_id, viewed_at
FROM v1.thread_views
ON CONFLICT (thread_id, user_id) DO NOTHING;

COMMIT;

\echo '=== Content migration complete ==='
SELECT 'threads' AS "table", (SELECT COUNT(*) FROM v1.threads) AS v1, COUNT(*) AS v2 FROM threads
UNION ALL SELECT 'comments', (SELECT COUNT(*) FROM v1.comments), COUNT(*) FROM comments
UNION ALL SELECT 'thread_votes', (SELECT COUNT(*) FROM v1.thread_votes), COUNT(*) FROM thread_votes
UNION ALL SELECT 'comment_votes', (SELECT COUNT(*) FROM v1.comment_votes), COUNT(*) FROM comment_votes
UNION ALL SELECT 'thread_tags', (SELECT COUNT(*) FROM v1.thread_tags), COUNT(*) FROM thread_tags
UNION ALL SELECT 'bookmarks', (SELECT COUNT(*) FROM v1.bookmarks), COUNT(*) FROM bookmarks
UNION ALL SELECT 'thread_views', (SELECT COUNT(*) FROM v1.thread_views), COUNT(*) FROM thread_views;
