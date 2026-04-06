# description: Run the full quality gate pipeline and report results

## Usage

```
/check
```

## Context Detection

- Triggered before opening or updating a PR, or when validating local changes
- No arguments required -- operates on the current working tree
- Can be invoked standalone or as a sub-step of other skills

## Workflow

Run each step sequentially. **Exit on first failure.**

1. **Format**

   ```bash
   just fmt
   ```

2. **Lint**

   ```bash
   just lint
   ```

3. **Typecheck** (detect which components have changes)

   ```bash
   # Frontend (TypeScript)
   pnpm run typecheck

   # v2 Server (Rust) -- only if crates/ has changes
   cargo clippy --all-targets -- --deny warnings
   ```

4. **Test**

   ```bash
   just test

   # Rust tests (fast, local)
   cargo test
   ```

5. **Build**

   ```bash
   just build
   ```

   Then use `mcp__nix-mcp__build` to build the Nix server package:

   ```
   mcp__nix-mcp__build(installable=".#server")
   ```

   On failure, extract errors from the returned log ID:

   ```
   mcp__nix-mcp__build_errors(log_id="<log-id>")
   ```

6. **Nix flake check** (runs all checks including server-clippy, server-test, server-fmt)

   ```
   mcp__nix-mcp__flake_check()
   ```

   On failure, extract errors from the returned log ID:

   ```
   mcp__nix-mcp__build_errors(log_id="<log-id>")
   ```

   Use `mcp__nix-mcp__get_log(log_id, grep="<pattern>")` to search large logs for specific errors.

If any step fails, stop the pipeline and enter plan mode:

- Use `build_errors` to extract actionable error lines before analyzing
- Group related errors by root cause
- Identify which files and modules are affected
- Propose a fix strategy before making changes
- Suggest `/fix-fast` for obvious issues or `/fix` for deeper analysis

## Component Detection

Detect which components are affected by uncommitted or staged changes:

| Path pattern   | Component      | Toolchain                                     |
| -------------- | -------------- | --------------------------------------------- |
| `crates/**`    | v2 Rust server | `cargo build`, `cargo test`, `cargo clippy`   |
| `src/**`       | Frontend       | `pnpm run lint:web && pnpm run typecheck:web` |
| `nix/**`       | Nix infra      | `nix flake check`                             |
| `tests/e2e/**` | E2E tests      | `pnpm exec playwright test`                   |

When changes span multiple components, run all relevant checks.

## Decision Points

| Signal              | Action                                             |
| ------------------- | -------------------------------------------------- |
| All steps pass      | Report success                                     |
| Format-only failure | Auto-fix with `just fmt`, re-run from step 2       |
| Lint or type errors | Enter plan mode, group by root cause               |
| Rust clippy warning | Fix the warning -- `--deny warnings` is enforced   |
| Test failure        | Enter plan mode, identify failing tests and causes |
| Build failure       | Enter plan mode, check for missing exports or deps |
| Nix check failure   | Run `build_errors(log_id)`, enter plan mode        |

## Output Format

```
## Quality Gate

| Step           | Status |
|----------------|--------|
| Format         | <pass/fail> |
| Lint           | <pass/fail> |
| Typecheck (TS) | <pass/fail> |
| Clippy (Rust)  | <pass/fail> |
| Test           | <pass/fail> |
| Build          | <pass/fail> |
| Nix check      | <pass/fail> |

<if failures>
### Failure Analysis

**Root cause:** <grouped description>
**Affected files:** <list>
**Suggested action:** /fix-fast | /fix
</if>
```
