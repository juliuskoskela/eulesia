# description: Fix CI failures using plan-first root-cause analysis

## Usage

```
/fix [pr-number]
```

## Context Detection

- Triggered after CI failures that are not obvious formatting or import issues
- Input: optional PR number to fetch CI logs from; otherwise uses local check output
- Requires: failing checks or a known failure to investigate

## Workflow

1. **Fetch failure logs.** Get CI output from GitHub Actions or local check results.

   ```bash
   # From GitHub Actions
   gh run list --repo Eulesia/eulesia --branch <branch> --limit 3
   gh run view <run-id> --repo Eulesia/eulesia --log-failed
   ```

   Or use local output from the last `/check` run.

2. **Enter plan mode.** Analyze failures before making any changes.
   - Parse all error messages and warnings
   - Group failures into clusters by root cause
   - Identify dependency chains (e.g., a type error causing downstream test failures)
   - Map each cluster to affected files and modules

3. **Propose fixes.** For each failure cluster, produce:
   - Root cause description
   - Affected files
   - Proposed fix (code change, config change, dependency update)
   - Risk assessment (could this fix break something else?)

4. **Implement fixes.** Apply changes cluster by cluster, starting with the root cause that unblocks the most downstream failures.

5. **Re-run checks.**

   ```bash
   just ci-check
   ```

6. **Push if green.**

   ```bash
   git add -A && git commit -m "<fix-description>"
   git push
   ```

   If checks still fail, loop back to step 2 with the new output.

## Decision Points

| Signal                                  | Action                                         |
| --------------------------------------- | ---------------------------------------------- |
| Single root cause, obvious fix          | Apply and verify                               |
| Multiple independent failures           | Fix in priority order (types > tests > lint)   |
| Failure in generated code or migrations | Check schema source, regenerate                |
| Flaky test                              | Identify flakiness, fix or mark as known-flaky |
| Unfamiliar failure domain               | Research before fixing, read related code      |

## Output Format

```
## Fix Report

### Failure Clusters

1. **<cluster-name>** (<N> errors)
   - Root cause: <description>
   - Files: <list>
   - Fix: <what was changed>
   - Status: <resolved | still failing>

### Checks After Fix

| Step       | Status |
|------------|--------|
| Format     | <pass/fail> |
| Lint       | <pass/fail> |
| Typecheck  | <pass/fail> |
| Test       | <pass/fail> |
| Build      | <pass/fail> |

### Commits

- `<hash>` <message>
```
