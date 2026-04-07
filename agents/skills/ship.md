# description: Verify merge readiness and merge a PR to upstream

## Usage

```
/ship <pr-number>
```

## Context Detection

- Triggered when a PR is believed ready to merge
- Input: PR number in the upstream repo
- Requires: approved PR with passing checks

## Workflow

1. **Verify CI is green.**

   ```bash
   gh pr checks <pr-number> --repo Eulesia/eulesia
   ```

   If any checks are failing, stop and run `/fix` or `/fix-fast`.

2. **Verify no unresolved review comments.**

   ```bash
   gh api repos/Eulesia/eulesia/pulls/<pr-number>/comments | jq '[.[] | select(.resolved == false)] | length'
   gh pr view <pr-number> --repo Eulesia/eulesia
   ```

   If there are unresolved comments, stop and run `/resolve`.

3. **Verify PR description is complete.** Check that the PR body contains:
   - Summary of changes
   - Test plan or verification steps
   - Reference to the issue being closed (if applicable)

4. **Assess impact.**

   ```bash
   gh pr diff <pr-number> --repo Eulesia/eulesia
   ```

   Check for:
   - **Docs impact:** Are there user-facing changes that need documentation?
   - **Migration impact:** Are there SeaORM migration changes?
   - **Security impact:** Are there changes to auth, permissions, secrets, or crypto?

   - **Data impact:** Are there migrations that modify or move data?
     If yes, run `/deploy-verify` after merge to confirm data integrity.

   Flag any concerns before proceeding.

   **CRITICAL: Never declare a migration "clean" based solely on code
   review or CI passing.** Migrations with `IF NOT EXISTS` succeed on
   empty databases. Data presence must be verified on the actual server.

5. **Sync fork before merge.**

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main --ff-only
   git push origin main
   ```

6. **Merge the PR.**

   ```bash
   gh pr merge <pr-number> --repo Eulesia/eulesia --squash --delete-branch
   ```

7. **Update fork main after merge.**

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main --ff-only
   git push origin main
   ```

## Decision Points

| Signal                     | Action                                         |
| -------------------------- | ---------------------------------------------- |
| CI failing                 | Stop, run `/fix`                               |
| Unresolved comments        | Stop, run `/resolve`                           |
| Missing PR description     | Update description before merging              |
| Schema/migration changes   | Double-check migration order and rollback plan |
| Data migration or DB move  | Run `/deploy-verify` after merge               |
| Security-sensitive changes | Flag for additional human review               |
| PR has merge conflicts     | Rebase branch, re-run checks                   |

## Output Format

```
## Ship Report

- PR: #<number> -- <title>
- Merge: <squash-merged | blocked>
- Commit: <hash>

### Pre-merge Checklist

- [x] CI green
- [x] No unresolved comments
- [x] PR description complete
- [ ] Docs impact: <none | details>
- [ ] Migration impact: <none | details>
- [ ] Data impact: <none | verified with /deploy-verify>
- [ ] Security impact: <none | details>

### Post-merge

- Fork synced: <yes/no>
- Branch cleaned: <yes/no>
```
