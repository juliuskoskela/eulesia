# description: Fast-path fix for obvious CI failures like formatting, imports, and type errors

## Usage

```
/fix-fast
```

## Context Detection

- Triggered when CI failures are clearly mechanical: formatting, missing imports, unused variables, simple type mismatches
- Should be attempted before `/fix` for efficiency
- Escalates to `/fix` if the issue is not obvious after inspection

## Workflow

1. **Inspect the failure output.** Read the error messages from the last check run.

   ```bash
   just ci-check 2>&1 | tail -100
   ```

2. **Classify the failure.** Is it one of these obvious categories?

   **TypeScript (frontend, v1 API):**
   - Formatting, missing imports, unused variables, simple type errors, missing exports

   **Rust (v2 server):**
   - `cargo fmt` diff, unused variables/imports, clippy warnings, missing `use`, borrow checker with obvious fix

   **Nix build/check:**
   - Use `mcp__nix-mcp__build_errors(log_id)` to extract error lines from failed `build` or `flake_check`
   - Format issues: `mcp__nix-mcp__fmt()` then re-check

3. **Fix directly.** Apply the minimal change to resolve the issue.

   ```bash
   # Formatting (all)
   just fmt

   # Then re-check per component
   just lint                   # JS/TS linters
   pnpm run typecheck          # TypeScript
   cargo clippy -- -D warnings # Rust
   ```

4. **Re-run the full check pipeline.**

   ```bash
   just ci-check
   ```

5. **Push if green.**

   ```bash
   git add -A && git commit -m "fix: <short-description>"
   git push
   ```

6. **Escalate if not obvious.** If after inspection the failure does not fall into an obvious category, or the fix attempt does not resolve it:

   > "This needs deeper analysis. Switching to /fix."

   Run `/fix` and stop here.

## Decision Points

| Signal                                   | Action                 |
| ---------------------------------------- | ---------------------- |
| `just fmt` produces diff                 | Apply format, re-check |
| Lint says unused import                  | Remove import          |
| Type error with clear expected vs actual | Fix the type           |
| Multiple interrelated type errors        | Escalate to `/fix`     |
| Test logic failure                       | Escalate to `/fix`     |
| Build failure in unfamiliar module       | Escalate to `/fix`     |

## Output Format

```
## Fast Fix

- Category: <formatting | import | type | lint>
- Files changed: <list>
- Fix: <one-line description>
- Checks: <passing | escalating to /fix>
```
