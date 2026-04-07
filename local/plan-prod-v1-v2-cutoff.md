# Production v1 -> v2 Cutoff Plan

Created: 2026-04-07
Status: Draft execution plan
Inputs:
- `local/investigation-prod-data-2026-04-07.md`
- `local/postmortem-v1-v2-migration-2026-04-07.md`
- test-server post-deploy verification from 2026-04-07

## Goal

Make `eulesia_v2` the only live write target in production, with a clean and
verifiable cutoff from `eulesia`, while keeping the v1 database intact for
rollback, audit, and historical inspection.

This is not a "wipe v1" plan. It is a **stop writing to v1, backfill the
remaining gaps, verify parity, then keep v1 read-only** plan.

## Constraints

- No destructive delete of the `eulesia` database during cutoff
- No more claims of "migration complete" without row-level verification
- Avoid prolonged dual-write mode; it hides bugs and makes parity impossible to
  prove
- Use a short controlled maintenance/cutoff window for the final delta import

## Current facts

Verified as of 2026-04-07:

- production app service points at `postgresql:///eulesia_v2`
- production still has both `eulesia` and `eulesia_v2`
- schema migrations in v2 are up to date
- production data parity is still incomplete
- test deploy is healthy on v2, but municipality coordinates are still missing
  and tracked separately in `local/issue-geolocation-parity.md`

Known production gaps from the investigation:

- `threads`: 3 v1-only rows still missing from v2
- `thread_tags`: 16 v1-only rows missing from v2
- clubs/rooms and related memberships/content are not fully migrated
- `moderation_actions`: `10 -> 0`
- `edit_history`: `9 -> 0`
- `thread_views`: partial in v2; needs an explicit policy
- DMs/messages need an explicit final migration or archive decision

## Target state

After cutoff:

- all active application traffic writes only to `eulesia_v2`
- all importers, cron jobs, admin flows, and background workers target v2 only
- required legacy data is backfilled into v2
- any intentionally non-migrated domains are documented as archive-only
- `eulesia` remains present but read-only
- post-deploy verification can prove there are no fresh writes landing in v1

## Execution plan

### Phase 1 — Freeze the moving parts

1. Inventory every writer that can still touch production data.
2. Classify each writer as:
   - v2 already
   - still writing to v1
   - unknown / externally hosted
3. For unknown writers, prove the target by configuration inspection or live
   test writes. Do not infer.
4. Prepare a cutoff window where importers and admin write paths can be paused.

Writers to verify explicitly:

- production app service
- any remaining import/scraper jobs
- admin tooling
- one-off maintenance scripts
- off-host jobs using stored DSNs/secrets

Exit criterion:
- there is a named owner and confirmed target database for every writer

### Phase 2 — Decide the data policy per domain

Not every v1 table needs the same treatment. Record the policy before touching
production:

- **must migrate fully**: users, public threads, tags, comments, votes,
  moderation history, clubs, rooms, memberships
- **migrate if operationally needed**: thread views, DM/message history
- **archive only**: caches and legacy-only helper tables with no v2 product
  surface

Open decisions that must be made before cutoff:

1. Are DMs fully migrated into v2 messaging, or kept as read-only legacy
   history?
2. Do `thread_views` need historical backfill, or is pre-cutover history
   acceptable to drop?
3. How are v1 rooms mapped in the final v2 model: private clubs only, or a
   separate archive representation?

Exit criterion:
- every mismatched table/domain from the production investigation has an
  explicit policy: migrate, archive, or ignore with justification

### Phase 3 — Build idempotent backfill tooling

Implement one-time backfill commands that can be rerun safely and produce a
 verification report.

Required backfill slices:

1. public threads and thread tags missing from v2
2. clubs, rooms, memberships, and related thread/comment/vote content
3. moderation actions and any linked admin audit records
4. edit history
5. optional: thread views
6. optional: DM/message history, depending on the policy from Phase 2

Requirements for every backfill script:

- idempotent by stable source identifier
- dry-run mode
- row-count summary before and after
- explicit log of inserted, skipped, and conflicted records
- no writes to v1

Exit criterion:
- each backfill script succeeds against a staging copy and can be rerun without
  duplicating data

### Phase 4 — Rehearse on a production-like copy

1. Restore a recent production snapshot into a rehearsal environment.
2. Point the v2 app at the rehearsal `eulesia_v2` copy.
3. Run the full backfill sequence.
4. Run parity queries for every tracked domain.
5. Exercise critical user flows:
   - public thread list/search
   - clubs and rooms
   - admin moderation history
   - notifications
   - DM visibility, if migrated

Exit criterion:
- rehearsal ends with zero unexpected diffs for all "must migrate fully"
  domains

### Phase 5 — Production cutoff window

This should be a short controlled window, not an open-ended dual-run period.

1. Announce the maintenance/cutoff window.
2. Pause or disable all nonessential background writers and importers.
3. Take fresh backups/snapshots of both `eulesia` and `eulesia_v2`.
4. Revoke or disable known v1 application write paths.
5. Run the final delta backfill from `eulesia` to `eulesia_v2`.
6. Run parity verification queries immediately.
7. Reconfigure any paused writers to use v2 only.
8. Bring traffic fully back and monitor.

Strong recommendation:

- do not do long-lived dual writes
- do not leave ambiguous DSNs in secrets/config
- do not reopen v1 writes after the cutoff except via an explicit rollback

Exit criterion:
- final parity verification passes, and all active writers are configured to v2

### Phase 6 — Lock v1 into archive mode

After the cutoff succeeds:

1. Remove write privileges to `eulesia` for app/import roles.
2. Keep read access only for admin/debug roles as needed.
3. Add a lightweight scheduled check that alerts if row counts in v1 change in
   active product tables.
4. Document the archive posture in deployment docs.

Exit criterion:
- v1 remains queryable but no routine production path can write to it

## Verification checklist

The cutoff is not done until all of these are true:

- `eulesia-server.service` uses `eulesia_v2`
- every known writer uses v2 credentials/config
- no fresh rows appear in tracked v1 tables for at least 24 hours after cutoff
- parity queries show zero diff for all mandatory domains
- search indexes reflect migrated/restored content
- admin moderation and audit history are visible in v2
- clubs/rooms and their memberships/content are visible in v2
- an intentionally non-migrated domain list is written down and approved

## What is not part of this cutoff

- dropping the `eulesia` database
- deleting legacy tables
- solving municipality coordinate/data quality by itself

That municipality issue is real, but separate. Track it in:

- `local/issue-geolocation-parity.md`

## Recommended implementation order

1. Finalize domain-by-domain migration policy decisions
2. Build idempotent backfill scripts
3. Rehearse on a production-like copy
4. Cut over writers with a short maintenance window
5. Lock v1 read-only
6. Only after a stable period, plan the actual legacy DB teardown
