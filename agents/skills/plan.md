# description: Architecture triage and implementation planning for complex changes

## Usage

```
/plan <issue-number-or-description>
```

## Context Detection

- Triggered when an issue is ambiguous, involves schema changes, touches multiple subsystems, or is escalated from `/impl`
- Input: GitHub issue number or free-text description
- Used before implementation to de-risk complex work

## Workflow

1. **Understand the issue.** Gather full context.

   ```bash
   gh issue view <number> --repo Eulesia/eulesia
   ```

   Read linked issues, referenced PRs, and any design discussion.

2. **Inspect affected code paths.** Trace through the codebase to understand:
   - Which modules and files are involved
   - Current data flow and API contracts
   - Existing tests covering the area
   - Database schema and migration history

   ```bash
   # Example: check schema
   ls crates/db/src/
   # Example: check migrations
   ls crates/db/src/migration/
   ```

3. **Decide on approach.** Choose one:

   | Approach                               | When                                                    |
   | -------------------------------------- | ------------------------------------------------------- |
   | **Direct implementation**              | Clear scope, no schema changes, isolated module         |
   | **Refactor first**                     | Current code structure blocks the change                |
   | **ADR (Architecture Decision Record)** | Multiple valid approaches, team alignment needed        |
   | **Migration-sensitive**                | Database schema changes, data backfill, rollback needed |

4. **Produce the plan.** Write a structured plan covering:
   - **Goal:** one-sentence summary of the desired outcome
   - **Approach:** chosen strategy from step 3
   - **Steps:** ordered implementation steps with file paths
   - **Schema changes:** if any, with migration strategy
   - **API changes:** if any, with backward-compat considerations
   - **Test strategy:** what to test, which test types
   - **Risks:** what could go wrong, mitigation

5. **Identify risks and open questions.**
   - Dependencies on other in-flight work
   - Performance implications
   - Security considerations
   - Backward compatibility concerns
   - **Data integrity**: Does this change affect persistent state on
     servers? If yes, plan how to verify data is correct after deploy.
     Schema migrations are NOT data migrations — `IF NOT EXISTS` succeeds
     on empty databases. Always plan a data verification step.

## Decision Points

| Signal                    | Action                              |
| ------------------------- | ----------------------------------- |
| Plan is approved          | Proceed to `/impl`                  |
| Plan reveals need for ADR | Write ADR, get team input           |
| Plan shows migration risk | Design rollback strategy first      |
| Plan is too large         | Break into smaller issues           |
| Open questions remain     | List them and ask for clarification |

## Output Format

```
## Plan: <title>

### Goal

<one-sentence summary>

### Approach

<direct | refactor-first | ADR-needed | migration-sensitive>

### Steps

1. <step with file paths>
2. <step with file paths>
...

### Schema Changes

<none, or migration details>

### API Changes

<none, or endpoint/contract changes>

### Test Strategy

- <unit tests for X>
- <integration tests for Y>

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| <risk> | <high/med/low> | <mitigation> |

### Data Verification

<If this change involves DB migrations, schema changes, or data movement:>
- How will you verify data is present after deploy?
- What row counts should you expect?
- Is there an existing database with data that must be preserved?
- Run `/deploy-verify` after merging.

### Open Questions

- <question>
```
