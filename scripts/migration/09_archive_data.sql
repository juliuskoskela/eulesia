-- v1 → v2 Migration: Archive data for dropped features
-- This copies v1 data into the v1_archive schema for reference.

BEGIN;

\echo '=== Archiving clubs ==='
INSERT INTO v1_archive.clubs SELECT * FROM v1.clubs;
INSERT INTO v1_archive.club_members SELECT * FROM v1.club_members;
INSERT INTO v1_archive.club_threads SELECT * FROM v1.club_threads;
INSERT INTO v1_archive.club_comments SELECT * FROM v1.club_comments;
INSERT INTO v1_archive.club_thread_votes SELECT * FROM v1.club_thread_votes;
INSERT INTO v1_archive.club_comment_votes SELECT * FROM v1.club_comment_votes;
INSERT INTO v1_archive.club_invitations SELECT * FROM v1.club_invitations;

\echo '=== Archiving rooms ==='
INSERT INTO v1_archive.rooms SELECT * FROM v1.rooms;
INSERT INTO v1_archive.room_members SELECT * FROM v1.room_members;
INSERT INTO v1_archive.room_threads SELECT * FROM v1.room_threads;
INSERT INTO v1_archive.room_comments SELECT * FROM v1.room_comments;
INSERT INTO v1_archive.room_thread_votes SELECT * FROM v1.room_thread_votes;
INSERT INTO v1_archive.room_comment_votes SELECT * FROM v1.room_comment_votes;
INSERT INTO v1_archive.room_invitations SELECT * FROM v1.room_invitations;

\echo '=== Archiving edit history ==='
INSERT INTO v1_archive.edit_history SELECT * FROM v1.edit_history;

\echo '=== Archiving admin accounts ==='
INSERT INTO v1_archive.admin_accounts SELECT * FROM v1.admin_accounts;
INSERT INTO v1_archive.admin_sessions SELECT * FROM v1.admin_sessions;

\echo '=== Archiving invite system ==='
INSERT INTO v1_archive.invite_codes SELECT * FROM v1.invite_codes;
INSERT INTO v1_archive.waitlist SELECT * FROM v1.waitlist;
INSERT INTO v1_archive.magic_links SELECT * FROM v1.magic_links;

\echo '=== Archiving institution features ==='
INSERT INTO v1_archive.institution_topics SELECT * FROM v1.institution_topics;
INSERT INTO v1_archive.institution_managers SELECT * FROM v1.institution_managers;
INSERT INTO v1_archive.tag_categories SELECT * FROM v1.tag_categories;

COMMIT;

\echo '=== Archive complete ==='
SELECT 'clubs' AS "table", COUNT(*) FROM v1_archive.clubs
UNION ALL SELECT 'rooms', COUNT(*) FROM v1_archive.rooms
UNION ALL SELECT 'edit_history', COUNT(*) FROM v1_archive.edit_history
UNION ALL SELECT 'admin_accounts', COUNT(*) FROM v1_archive.admin_accounts
UNION ALL SELECT 'invite_codes', COUNT(*) FROM v1_archive.invite_codes;
