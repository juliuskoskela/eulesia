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

1. **Fetch review comments.**

   ```bash
   gh pr view <pr-number> --repo Eulesia/eulesia --comments
   gh api repos/Eulesia/eulesia/pulls/<pr-number>/comments
   gh api repos/Eulesia/eulesia/pulls/<pr-number>/reviews
   ```

2. **Normalize comments into a task list.** For each comment:
   - Extract the request or concern
   - Identify the file and line
   - Classify: code change, question, nit, blocking, suggestion
   - Group by theme (e.g., "error handling", "naming", "testing")

3. **Implement by theme.** Address grouped comments together for coherent changes.
   - Blocking comments first
   - Code changes second
   - Nits and suggestions last
   - Answer questions as PR comment replies where no code change is needed

4. **Re-run checks.**

   ```bash
   just ci-check
   ```

5. **Push updates.**

   ```bash
   git add -A && git commit -m "fix: address review feedback"
   git push
   ```

6. **Summarize as a PR comment.** Post a reply summarizing what was addressed.

   ```bash
   gh pr comment <pr-number> --repo Eulesia/eulesia --body "$(cat <<'EOF'
   ## Review feedback addressed

   <themed summary of changes>

   ### Outstanding items
   - <anything not addressed and why>
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

## Output Format

```
## Resolve Report

### Comments Addressed

| # | Theme | Type | File | Status |
|---|-------|------|------|--------|
| 1 | <theme> | <blocking/suggestion/nit> | <file> | <done/skipped/needs-discussion> |

### Changes Made

- <commit-message-style summary per theme>

### Outstanding

- <items not addressed and reason>

### Checks

- CI: <passing/failing>
```
