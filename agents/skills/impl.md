# description: Start implementation from an issue or task description

## Usage

```
/impl <issue-number-or-description>
```

## Context Detection

- Triggered when starting work on a new feature, fix, or chore
- Input: GitHub issue number (e.g. `#42`) or free-text task description
- Requires: clean working tree, access to upstream remote

## Workflow

1. **Parse the issue** -- understand scope, acceptance criteria, and affected areas.

   ```bash
   gh issue view <number> --repo Eulesia/eulesia
   ```

2. **Decide if design is needed.** If the issue involves schema changes, new subsystems, cross-cutting concerns, or is ambiguous, escalate:

   > "This looks like it needs a design pass. Switching to /plan."

   Run `/plan` and stop here until the plan is approved.

3. **Sync fork with upstream.**

   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main --ff-only
   git push origin main
   ```

4. **Create a feature branch.** Use the conventional prefix (`feat/`, `fix/`, `chore/`, `docs/`, `triage/`).

   ```bash
   git checkout -b <prefix>/<short-slug>
   ```

5. **Implement the change.** Write code, tests, and update documentation as needed. Keep commits atomic and well-messaged.

6. **Run the full quality gate.**

   ```bash
   just ci-check
   ```

   If any step fails, run `/fix-fast` for obvious issues or `/fix` for deeper problems.

7. **Open a draft PR to upstream.**

   ```bash
   git push -u origin <branch>
   gh pr create \
     --repo Eulesia/eulesia \
     --head juliuskoskela:<branch> \
     --draft \
     --title "<conventional-title>" \
     --body "$(cat <<'EOF'
   ## Summary
   <what and why>

   ## Changes
   <bulleted list>

   ## Test plan
   - [ ] <verification steps>

   Closes #<issue>
   EOF
   )"
   ```

## Decision Points

| Signal                            | Action                     |
| --------------------------------- | -------------------------- |
| Issue is clear, small scope       | Proceed directly to step 3 |
| Schema change or migration needed | Escalate to `/plan`        |
| Ambiguous requirements            | Escalate to `/plan`        |
| CI failures after implementation  | Run `/fix-fast` or `/fix`  |

## Output Format

```
## Implementation started

- Branch: `<branch-name>`
- PR: <url> (draft)
- Status: <passing | failing -- details>
- Next: <what remains, if anything>
```
