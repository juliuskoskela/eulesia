# description: Perform code review on a pull request

## Usage

```
/review <pr-number>
```

## Context Detection

- Triggered when asked to review a PR or when reviewing before merge
- Input: PR number in the upstream repo
- Requires: an open PR with a diff to evaluate

## Workflow

1. **Fetch the PR context.**

   ```bash
   gh pr view <pr-number> --repo Eulesia/eulesia
   gh pr diff <pr-number> --repo Eulesia/eulesia
   ```

2. **Understand the change.** Read the PR description, linked issue, and commit messages to understand intent.

   ```bash
   gh pr view <pr-number> --repo Eulesia/eulesia --comments
   ```

3. **Evaluate the diff.** Review against these criteria:
   - **Correctness:** Does the code do what it claims? Are edge cases handled?
   - **Types:** Are TypeScript types accurate and specific (no unnecessary `any`)?
   - **Schema:** Are Drizzle schema changes correct? Do migrations exist and are they ordered properly?
   - **Tests:** Are there tests for new functionality? Do existing tests still make sense?
   - **Security:** Are there auth/permission/input-validation issues? Secret exposure?
   - **Performance:** Are there N+1 queries, unbounded loops, or missing pagination?
   - **API contracts:** Do endpoint changes maintain backward compatibility?

4. **Check Drizzle migrations specifically.**

   ```bash
   # Look for schema changes in the diff
   gh pr diff <pr-number> --repo Eulesia/eulesia | grep -A 5 "schema\|migration"
   ```

   Verify:
   - SeaORM migration files are present for schema changes in `crates/db/src/migration/`
   - Migration order is correct
   - Rollback is possible (no destructive changes without plan)

5. **Identify missing tests.** For each functional change, check if there is a corresponding test. Flag untested code paths.

6. **Produce review comments.** Categorize findings:
   - **Blocking:** must fix before merge
   - **Suggestion:** would improve but not required
   - **Nit:** style/naming, low priority
   - **Question:** need clarification from author

## Decision Points

| Signal                            | Action                    |
| --------------------------------- | ------------------------- |
| No issues found                   | Approve                   |
| Only nits                         | Approve with comments     |
| Suggestions but no blockers       | Approve with comments     |
| Blocking issues                   | Request changes           |
| Schema changes without migrations | Block, request migrations |
| Security concern                  | Block, flag explicitly    |
| Missing tests for core logic      | Request tests             |

## Output Format

```
## Review: PR #<number> -- <title>

### Verdict: <approve | approve-with-comments | request-changes>

### Summary

<2-3 sentence overview of the change quality>

### Findings

#### Blocking

- [ ] <file:line> -- <issue description>

#### Suggestions

- <file:line> -- <suggestion>

#### Nits

- <file:line> -- <nit>

#### Questions

- <file:line> -- <question>

### Migration Check

- Schema changes: <yes/no>
- Migrations present: <yes/no/n-a>
- Migration order: <correct/incorrect/n-a>

### Test Coverage

- New code tested: <yes/partially/no>
- Missing test areas: <list or "none">
```
