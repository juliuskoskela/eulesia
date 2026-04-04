# description: Address PR review comments and push updates

## Usage

```
/resolve <pr-number>
```

## Context Detection

- Triggered after receiving review feedback on a pull request
- Input: PR number in the upstream repo
- Requires: an open PR with review comments

## Workflow

1. **Fetch review comments.** Use these exact commands to pull all comment types:

   ```bash
   # PR-level review comments (inline code comments from reviewers)
   gh api repos/Eulesia/eulesia/pulls/<pr-number>/comments \
     --jq '.[] | {id: .id, path: .path, line: .line, body: .body}'

   # PR review summaries (approve/request-changes bodies)
   gh api repos/Eulesia/eulesia/pulls/<pr-number>/reviews \
     --jq '.[] | {id: .id, state: .state, body: .body}'

   # PR conversation comments (non-inline discussion)
   gh pr view <pr-number> --repo Eulesia/eulesia --comments
   ```

   All three must be checked — reviewers use different comment types.

2. **Normalize comments into a task list.** For each comment:
   - Extract the request or concern
   - Identify the file and line (from `path` + `line` fields)
   - Classify: blocking, code-change, suggestion, nit, question
   - Assign a number for tracking

3. **Implement fixes.** Address each comment individually.
   - Blocking comments first
   - Code changes second
   - Nits and suggestions last
   - Questions: reply inline, no code change needed

4. **Reply to each comment individually.** After fixing, reply to every
   review comment with what was done:

   ```bash
   # Reply to an inline review comment
   gh api repos/Eulesia/eulesia/pulls/<pr-number>/comments/<comment-id>/replies \
     -f body="Fixed in <commit-hash>: <one-line description of fix>"

   # Reply to a PR conversation comment
   gh pr comment <pr-number> --repo Eulesia/eulesia \
     --body "Re: <quoted concern> — Fixed: <description>"
   ```

   For deferred items, reply explaining why and when it will be addressed.

5. **Re-run checks.**

   ```bash
   cargo clippy --all-targets -- -D warnings
   cargo test --workspace
   ```

6. **Push updates.**

   ```bash
   git add -A && git commit -m "fix: address review feedback"
   git push
   ```

7. **Post summary comment.** After all individual replies are posted,
   add one summary comment listing everything:

   ```bash
   gh pr comment <pr-number> --repo Eulesia/eulesia --body "$(cat <<'EOF'
   ## Review feedback addressed

   | # | Comment | Status |
   |---|---------|--------|
   | 1 | <one-line summary> | Fixed in <hash> |
   | 2 | <one-line summary> | Fixed in <hash> |
   | 3 | <one-line summary> | Deferred — <reason> |

   ### Deferred items
   - <item>: <why deferred, when it will be addressed>

   ### Checks
   - `cargo test`: <N> tests pass
   - `cargo clippy`: clean
   EOF
   )"
   ```

## Decision Points

| Signal                                          | Action                                       |
| ----------------------------------------------- | -------------------------------------------- |
| Comment is a question, no code change needed    | Reply with explanation                       |
| Comment requests design change                  | Evaluate scope; escalate to `/plan` if large |
| Comment about missing tests                     | Write the tests                              |
| Comment about naming/style                      | Apply the suggestion                         |
| Contradictory comments from different reviewers | Flag and ask for clarification               |
| Comment already fixed in a prior commit         | Reply citing the commit hash                 |

## Output Format

```
## Resolve Report

### Comments Addressed

| # | Comment | Type | File | Status |
|---|---------|------|------|--------|
| 1 | <summary> | blocking | <file:line> | Fixed in <hash> |
| 2 | <summary> | suggestion | <file:line> | Fixed in <hash> |
| 3 | <summary> | nit | <file:line> | Deferred |

### Deferred

- <item>: <reason and timeline>

### Checks

- Tests: <count> pass
- Clippy: clean
```
