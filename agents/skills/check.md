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

3. **Typecheck**

   ```bash
   npm run typecheck
   ```

4. **Test**

   ```bash
   just test
   ```

5. **Build**

   ```bash
   just build
   ```

6. **Nix flake check**

   ```bash
   nix flake check
   ```

If any step fails, stop the pipeline and enter plan mode:

- Group related errors by root cause
- Identify which files and modules are affected
- Propose a fix strategy before making changes
- Suggest `/fix-fast` for obvious issues or `/fix` for deeper analysis

## Decision Points

| Signal              | Action                                             |
| ------------------- | -------------------------------------------------- |
| All steps pass      | Report success                                     |
| Format-only failure | Auto-fix with `just fmt`, re-run from step 2       |
| Lint or type errors | Enter plan mode, group by root cause               |
| Test failure        | Enter plan mode, identify failing tests and causes |
| Build failure       | Enter plan mode, check for missing exports or deps |
| Nix check failure   | Enter plan mode, inspect flake outputs             |

## Output Format

```
## Quality Gate

| Step       | Status |
|------------|--------|
| Format     | <pass/fail> |
| Lint       | <pass/fail> |
| Typecheck  | <pass/fail> |
| Test       | <pass/fail> |
| Build      | <pass/fail> |
| Nix check  | <pass/fail> |

<if failures>
### Failure Analysis

**Root cause:** <grouped description>
**Affected files:** <list>
**Suggested action:** /fix-fast | /fix
</if>
```
